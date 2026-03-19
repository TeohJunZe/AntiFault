import os
import torch
import torch.nn as nn
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional

# ==========================================
# 1. CONSTANTS & CONFIGURATION
# ==========================================
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
RUL_CAP    = 125
SEQ_LEN    = 40
D_MODEL    = 96
N_HEAD     = 3
NUM_LAYERS = 3
DROPOUT    = 0.2
HEALTH_DIM = 64
IG_STEPS   = 30   # Integrated Gradients interpolation steps

op_cols         = ['op_setting_1', 'op_setting_2', 'op_setting_3']
all_sensor_cols = [f'sensor_{i}' for i in range(1, 22)]

# ==========================================
# 2. PYDANTIC SCHEMAS
# ==========================================
class SensorExplanation(BaseModel):
    sensor:        str
    importance:    float   # 0–1, fraction of total attribution
    direction:     str     # "raises_rul" | "lowers_rul"
    plain_english: str     # one-sentence human explanation

class InferenceRequest(BaseModel):
    engine_id:      str
    flight_history: List[Dict[str, float]]

class InferenceResponse(BaseModel):
    engine_id:         str
    predicted_rul:     float
    confidence_margin: float
    anomaly_score:     float
    status:            str
    # ── NEW explainability fields ──────────────────────────────────────
    top_sensors:     List[SensorExplanation]  # always 2 entries
    attn_peak_cycle: int   # which of the last 40 cycles the model focused on most

# ==========================================
# 3. FASTAPI APP & MODEL LOADING
# ==========================================
app = FastAPI(title="SOTA Predictive Maintenance API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline_data:     Optional[dict] = None
ensemble_models:   list           = []
important_sensors: list           = []
feature_cols:      list           = []
sensor_map:        Dict[int, str] = {}  # feature_index → base sensor name, built at startup


def _build_sensor_map(feat_cols: list, sensors: list) -> Dict[int, str]:
    """Map every feature column index back to its parent sensor name."""
    mapping = {}
    for i, col in enumerate(feat_cols):
        for s in sensors:
            if col == s or col.startswith(s + "_"):
                mapping[i] = s
                break
    return mapping


def load_production_core():
    global pipeline_data, ensemble_models, important_sensors, feature_cols, sensor_map

    current_dir = os.path.dirname(os.path.abspath(__file__))
    model_path  = os.path.join(current_dir, 'production_core.pt')

    if not os.path.exists(model_path):
        raise RuntimeError(f"{model_path} not found! Place it in the backend directory.")

    package           = torch.load(model_path, map_location=device, weights_only=False)
    pipeline_data     = package['pipeline']
    important_sensors = pipeline_data['sensors']

    feature_cols = (
        important_sensors
        + [f'{c}_diff'      for c in important_sensors]
        + [f'{c}_mean_{w}'  for c in important_sensors for w in [5, 10, 20, 30]]
        + [f'{c}_std_{w}'   for c in important_sensors for w in [5, 10, 20, 30]]
        + [f'{c}_slope_{w}' for c in important_sensors for w in [10, 20]]
    )
    sensor_map = _build_sensor_map(feature_cols, important_sensors)

    # ── Architecture ─────────────────────────────────────────────────────
    # KEY CHANGE vs original: forward() now returns attn_weights as a 5th value
    # so the explainer can report which cycle the model focused on most.
    class Generalized_PM_Architecture(nn.Module):
        def __init__(self, num_features=len(feature_cols), d_model=D_MODEL,
                     nhead=N_HEAD, num_layers=NUM_LAYERS, dropout=DROPOUT):
            super().__init__()
            self.conv1 = nn.Conv1d(num_features, d_model, kernel_size=3, padding=1, dilation=1)
            self.norm1 = nn.GroupNorm(1, d_model)
            self.conv2 = nn.Conv1d(d_model, d_model, kernel_size=3, padding=2, dilation=2)
            self.norm2 = nn.GroupNorm(1, d_model)
            self.conv3 = nn.Conv1d(d_model, d_model, kernel_size=3, padding=4, dilation=4)
            self.norm3 = nn.GroupNorm(1, d_model)
            self.relu  = nn.ReLU()

            pe = torch.zeros(SEQ_LEN, d_model)
            pos      = torch.arange(0, SEQ_LEN, dtype=torch.float).unsqueeze(1)
            div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-np.log(10000.0) / d_model))
            pe[:, 0::2] = torch.sin(pos * div_term)
            pe[:, 1::2] = torch.cos(pos * div_term)
            self.register_buffer('pos_encoder', pe.unsqueeze(0))

            enc_layer = nn.TransformerEncoderLayer(
                d_model=d_model, nhead=nhead, dim_feedforward=d_model * 4,
                dropout=dropout, batch_first=True, norm_first=True)
            self.transformer = nn.TransformerEncoder(
                enc_layer, num_layers=num_layers, enable_nested_tensor=False)

            self.attn             = nn.Sequential(nn.Linear(d_model, 128), nn.GELU(), nn.Linear(128, 1))
            self.health_embedding = nn.Sequential(nn.Linear(d_model, HEALTH_DIM), nn.GELU(), nn.Dropout(dropout))
            self.rul_head         = nn.Linear(HEALTH_DIM, 2)
            self.decoder_expansion= nn.Linear(HEALTH_DIM, d_model)
            self.decoder_upsample = nn.ConvTranspose1d(d_model, d_model, kernel_size=SEQ_LEN)
            self.decoder_conv     = nn.Sequential(
                nn.Conv1d(d_model, d_model, 3, padding=1),
                nn.GELU(),
                nn.Conv1d(d_model, num_features, 3, padding=1))

        def forward(self, x):
            h    = x.permute(0, 2, 1)
            res1 = self.relu(self.norm1(self.conv1(h)))
            res2 = self.relu(self.norm2(self.conv2(res1)) + res1)
            h    = self.relu(self.norm3(self.conv3(res2)) + res2)
            h    = h.permute(0, 2, 1) + self.pos_encoder
            h    = self.transformer(h)

            # Attention weights RETURNED so caller can inspect them
            attn_scores  = self.attn(h).squeeze(-1)
            attn_weights = torch.softmax(attn_scores, dim=1)   # (B, SEQ_LEN)
            context      = torch.sum(attn_weights.unsqueeze(-1) * h, dim=1)

            health_idx = self.health_embedding(context)
            rul_out    = self.rul_head(health_idx)
            pred_rul   = self.relu(rul_out[:, 0])
            log_var    = rul_out[:, 1]

            dec   = self.decoder_upsample(self.decoder_expansion(health_idx).unsqueeze(-1))
            recon = self.decoder_conv(dec).permute(0, 2, 1)

            return pred_rul, log_var, recon, health_idx, attn_weights  # 5 values

    for weights in package['ensemble_weights']:
        model = Generalized_PM_Architecture(num_features=len(feature_cols)).to(device)
        model.load_state_dict(weights)
        model.eval()
        ensemble_models.append(model)

    print(f"✅ API Initialized | {len(ensemble_models)} models | "
          f"{len(feature_cols)} features | device={device}")


@app.on_event("startup")
async def startup_event():
    load_production_core()

# ==========================================
# 4. PREPROCESSING PIPELINE
# ==========================================
def _rolling_slope_fast(series, w):
    x = np.arange(w, dtype=np.float32);  x -= x.mean()
    x_var = (x ** 2).sum()
    def _slope(arr):
        arr = arr - arr.mean()
        return (x[:len(arr)] * arr).sum() / (x_var + 1e-8)
    return series.rolling(w, min_periods=w).apply(_slope, raw=True).fillna(0)

def extract_features(df: pd.DataFrame) -> pd.DataFrame:
    """Single-engine feature engineering (no groupby — one engine per request)."""
    df[important_sensors] = df[important_sensors].ewm(span=5, adjust=False).mean().astype(np.float32)
    new_features = {}
    for col in important_sensors:
        new_features[f'{col}_diff'] = df[col].diff().fillna(0).astype(np.float32)
        for w in [5, 10, 20, 30]:
            new_features[f'{col}_mean_{w}'] = df[col].rolling(w, min_periods=1).mean().astype(np.float32)
            new_features[f'{col}_std_{w}']  = df[col].rolling(w, min_periods=1).std().fillna(0).astype(np.float32)
        for w in [10, 20]:
            new_features[f'{col}_slope_{w}'] = _rolling_slope_fast(df[col], w).astype(np.float32)
    return pd.concat([df, pd.DataFrame(new_features, index=df.index)], axis=1).fillna(0)

# ==========================================
# 5. EXPLAINABILITY — INTEGRATED GRADIENTS
# ==========================================
def _integrated_gradients(model, x: torch.Tensor) -> np.ndarray:
    """
    Compute Integrated Gradients of pred_rul w.r.t. every input feature.

    What it does:
        We interpolate IG_STEPS inputs between a zero baseline (neutral sensor
        state) and the actual input x.  At each step we compute d(RUL)/d(input)
        via backprop.  The average gradient × (x − baseline) gives each feature's
        contribution to the final RUL number in interpretable units.

    Returns:
        ig: np.ndarray of shape (num_features,)
            Positive  → feature pushed predicted RUL higher (healthy signal)
            Negative  → feature pushed predicted RUL lower (degradation signal)
    """
    baseline = torch.zeros_like(x)                                     # (1, SEQ_LEN, F)
    alphas   = torch.linspace(0, 1, IG_STEPS, device=x.device)        # (steps,)

    # Build all interpolated inputs at once: shape (steps, SEQ_LEN, F)
    interp = (baseline + alphas[:, None, None, None] * (x - baseline)).squeeze(1)
    interp.requires_grad_(True)

    pred_rul, *_ = model(interp)     # forward on a batch of `steps` inputs
    pred_rul.sum().backward()        # accumulate gradients

    grads     = interp.grad.detach()         # (steps, SEQ_LEN, F)
    mean_grad = grads.mean(dim=(0, 1))       # (F,) — averaged over steps and time

    # IG = mean_grad × (x − 0); baseline is zero so this simplifies to input mean
    ig = mean_grad * x.squeeze(0).mean(dim=0).detach()   # (F,)
    return ig.cpu().numpy()


def _aggregate_to_sensors(ig: np.ndarray) -> Dict[str, dict]:
    """
    Roll up per-feature IG scores to per-sensor importance.

    Each base sensor contributes many derived features (diff, mean_10, std_20 …).
    Importance = sum of |IG| across all features for that sensor.
    Direction  = sign of the raw sensor feature's own IG value.

    Returns dict sorted by importance descending:
        { "sensor_14": { "importance": 0.31, "ig_sign": -2.4 }, … }
    """
    magnitude: Dict[str, float] = {}
    direction: Dict[str, float] = {}

    for feat_idx, ig_val in enumerate(ig):
        sensor = sensor_map.get(feat_idx)
        if sensor is None:
            continue
        magnitude[sensor] = magnitude.get(sensor, 0.0) + abs(float(ig_val))
        # Raw feature has the exact same name as the sensor
        if feature_cols[feat_idx] == sensor:
            direction[sensor] = float(ig_val)

    total = sum(magnitude.values()) or 1.0
    return {
        s: {
            "importance": round(mag / total, 4),
            "ig_sign":    direction.get(s, 0.0),
        }
        for s, mag in sorted(magnitude.items(), key=lambda kv: kv[1], reverse=True)
    }


def _build_explanation(sensor: str, info: dict, predicted_rul: float) -> SensorExplanation:
    """Convert raw IG numbers into a plain-English sentence for the API response."""
    is_healthy = info["ig_sign"] > 0
    pct        = round(info["importance"] * 100, 1)
    rul_int    = int(predicted_rul)

    direction_str = "raises_rul" if is_healthy else "lowers_rul"

    if is_healthy:
        sentence = (
            f"{sensor} is operating normally and accounts for {pct}% of the "
            f"factors supporting the {rul_int}-cycle life estimate."
        )
    else:
        sentence = (
            f"{sensor} shows signs of degradation and is the {pct}% contributor "
            f"pulling the predicted life down to {rul_int} cycles."
        )

    return SensorExplanation(
        sensor=sensor,
        importance=info["importance"],
        direction=direction_str,
        plain_english=sentence,
    )

# ==========================================
# 6. /predict  (with explainability)
# ==========================================
@app.post("/predict", response_model=InferenceResponse)
async def predict_rul(request: InferenceRequest):
    if not request.flight_history:
        raise HTTPException(400, "flight_history cannot be empty.")

    # ── 1. Validate and build DataFrame ───────────────────────────────
    df      = pd.DataFrame(request.flight_history)
    missing = [c for c in op_cols + all_sensor_cols if c not in df.columns]
    if missing:
        raise HTTPException(400, f"Missing columns in payload: {missing}")

    # ── 2. Apply KMeans regime + scalers ──────────────────────────────
    df['regime'] = pipeline_data['kmeans'].predict(df[op_cols])
    for regime, scaler in pipeline_data['scalers'].items():
        mask = df['regime'] == regime
        if mask.sum() > 0:
            df.loc[mask, important_sensors] = scaler.transform(df.loc[mask, important_sensors])

    # ── 3. Feature engineering ─────────────────────────────────────────
    df = extract_features(df)

    # ── 4. Build sequence tensor  (1, SEQ_LEN, F) ──────────────────────
    data = df[feature_cols].values.astype(np.float32)
    if len(data) < SEQ_LEN:
        data = np.pad(data, ((SEQ_LEN - len(data), 0), (0, 0)), 'edge')
    seq      = data[-SEQ_LEN:]
    X_tensor = torch.tensor(seq[np.newaxis], dtype=torch.float32, device=device)

    # ── 5. Ensemble inference ──────────────────────────────────────────
    ensemble_preds, ensemble_vars, ensemble_anoms, ensemble_attn = [], [], [], []

    with torch.no_grad():
        for model in ensemble_models:
            pred_rul, log_var, recon, _, attn_w = model(X_tensor)

            ensemble_preds.append(float(np.clip(pred_rul.cpu().item(), 0, RUL_CAP)))
            ensemble_vars.append(float(torch.exp(log_var).cpu().item()))
            ensemble_anoms.append(float(torch.mean((recon - X_tensor) ** 2).cpu().item()))
            ensemble_attn.append(attn_w.squeeze(0).cpu().numpy())   # (SEQ_LEN,)

    final_rul = float(np.mean(ensemble_preds))
    margin    = float(2 * np.sqrt(np.mean(ensemble_vars) + np.var(ensemble_preds)))
    anomaly   = float(np.mean(ensemble_anoms))

    # Peak attention cycle — 0-indexed within the last 40 cycles
    mean_attn       = np.mean(ensemble_attn, axis=0)   # (SEQ_LEN,)
    attn_peak_cycle = int(np.argmax(mean_attn))

    # ── 6. Integrated Gradients explainability ─────────────────────────
    # Run IG on the first ensemble model (all share the same frozen encoder,
    # so attributions are representative of the full ensemble).
    ig_scores    = _integrated_gradients(ensemble_models[0], X_tensor.clone())
    sensor_attrs = _aggregate_to_sensors(ig_scores)   # sorted by importance

    # Top 2 sensors only
    top2        = list(sensor_attrs.items())[:2]
    top_sensors = [_build_explanation(name, info, final_rul) for name, info in top2]

    # ── 7. Status label ────────────────────────────────────────────────
    if final_rul <= 30 or anomaly > 1.5:
        status = "CRITICAL — MAINTENANCE REQUIRED"
    elif final_rul <= 60:
        status = "WARNING — DEGRADATION DETECTED"
    else:
        status = "HEALTHY"

    return InferenceResponse(
        engine_id=request.engine_id,
        predicted_rul=round(final_rul, 1),
        confidence_margin=round(margin, 2),
        anomaly_score=round(anomaly, 4),
        status=status,
        top_sensors=top_sensors,
        attn_peak_cycle=attn_peak_cycle,
    )

# ==========================================
# 7. /detect_changepoint  (unchanged logic,
#    updated to unpack 5 return values)
# ==========================================
@app.post("/detect_changepoint")
async def detect_changepoint(request: InferenceRequest):
    if len(request.flight_history) < 10:
        raise HTTPException(400, "Need at least 10 flights to establish a baseline.")

    df = pd.DataFrame(request.flight_history)
    df['regime'] = pipeline_data['kmeans'].predict(df[op_cols])
    for regime, scaler in pipeline_data['scalers'].items():
        mask = df['regime'] == regime
        if mask.sum() > 0:
            df.loc[mask, important_sensors] = scaler.transform(df.loc[mask, important_sensors])
    df = extract_features(df)

    data       = df[feature_cols].values.astype(np.float32)
    num_flights= len(data)
    X_history  = []

    for i in range(num_flights):
        window = data[max(0, i - SEQ_LEN + 1): i + 1]
        if len(window) < SEQ_LEN:
            window = np.pad(window, ((SEQ_LEN - len(window), 0), (0, 0)), 'edge')
        X_history.append(window)

    X_tensor = torch.tensor(np.array(X_history), dtype=torch.float32, device=device)

    ensemble_anomalies = np.zeros(num_flights)
    ensemble_ruls      = np.zeros(num_flights)

    with torch.no_grad():
        for model in ensemble_models:
            pred_rul, _, recon, _, _ = model(X_tensor)   # unpack all 5 values
            ensemble_ruls      += np.clip(pred_rul.cpu().numpy().flatten(), 0, RUL_CAP)
            ensemble_anomalies += torch.mean((recon - X_tensor) ** 2, dim=(1, 2)).cpu().numpy()

    ensemble_ruls      /= len(ensemble_models)
    ensemble_anomalies /= len(ensemble_models)

    baseline_anomaly  = np.mean(ensemble_anomalies[:10])
    anomaly_threshold = baseline_anomaly * 2.5

    change_point_cycle = -1
    trigger_reason     = "Engine is currently in a fully healthy state."

    for cycle in range(num_flights):
        if ensemble_ruls[cycle] < 120:
            change_point_cycle = cycle + 1
            trigger_reason = (
                f"Thermodynamic degradation began "
                f"(RUL dropped to {ensemble_ruls[cycle]:.1f})")
            break
        if cycle > 10 and ensemble_anomalies[cycle] > anomaly_threshold:
            change_point_cycle = cycle + 1
            trigger_reason = (
                f"Anomaly spike detected "
                f"(score: {ensemble_anomalies[cycle]:.4f})")
            break

    return {
        "engine_id":              request.engine_id,
        "total_flights_analyzed": num_flights,
        "is_impaired":            change_point_cycle != -1,
        "impaired_flight_cycle":  change_point_cycle if change_point_cycle != -1 else None,
        "transition_reason":      trigger_reason,
    }

# ==========================================
# 8. ENTRYPOINT
# ==========================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)