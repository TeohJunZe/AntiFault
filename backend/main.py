import os
import math
import torch
import torch.nn as nn
import pandas as pd
import numpy as np
from copy import deepcopy
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional

# ==========================================
# 1. CONSTANTS & CONFIGURATION
#    (defaults — overridden at startup from
#     the deploy_bundle hyperparameters)
# ==========================================
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

RUL_CAP     = 125
SEQ_LEN     = 60
D_MODEL     = 128
N_HEAD      = 4
NUM_LAYERS  = 4
DROPOUT     = 0.15
HEALTH_DIM  = 96

# These are populated from the bundle at startup
REGISTRY_SENSOR_ORDER: List[str] = []
REGISTRY_SENSOR_IDS:   Dict[str, int] = {}
COMPONENT_MAP:         Dict[str, List[str]] = {}
CALIBRATION_STATS:     Optional[dict] = None
RISK_THRESHOLDS:       dict = {}

# Operating-settings column names used by the bundle's preprocessing
OP_COLS = ['setting_1', 'setting_2', 'setting_3']

# Mapping from the API's external column names to the bundle's internal names
OP_COLS_API_MAP = {
    'op_setting_1': 'setting_1',
    'op_setting_2': 'setting_2',
    'op_setting_3': 'setting_3',
}

# All 21 sensor columns the API accepts in flight_history rows
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
    # ── explainability fields ──────────────────────────────────────────
    top_sensors:     List[SensorExplanation]  # always 2 entries
    attn_peak_cycle: int   # which of the last SEQ_LEN cycles the model focused on most
    risk_level:      str
    recommendation:  str
    confidence_note: str
    report_text:     str
    uncertainty_sigma: float = 0.0
    anomaly_z: float = 0.0
    suspected_components: List[str] = []

# ==========================================
# 3. MODEL ARCHITECTURE
#    (SensorTokenRULModel from deploy_bundle)
# ==========================================

class OnlineSensorNorm(nn.Module):
    """Per-sensor running normalization (mean/std stored as buffers)."""
    def __init__(self, max_sensors: int):
        super().__init__()
        self.register_buffer("running_mean", torch.zeros(max_sensors))
        self.register_buffer("running_std", torch.ones(max_sensors))

    def forward(self, sensor_values: torch.Tensor):
        mean = self.running_mean.view(1, 1, -1)
        std  = self.running_std.view(1, 1, -1)
        return (sensor_values - mean) / std


class MaskedGatedAggregator(nn.Module):
    """Gated aggregation across the sensor dimension."""
    def __init__(self, d_model: int):
        super().__init__()
        self.gate = nn.Sequential(
            nn.Linear(d_model, d_model),
            nn.GELU(),
            nn.Linear(d_model, 1),
        )

    def forward(self, tokens: torch.Tensor, mask: torch.Tensor):
        logits = self.gate(tokens).squeeze(-1)
        logits = logits.masked_fill(mask <= 0, -1e4)
        weights = torch.softmax(logits, dim=2)
        aggregated = torch.sum(tokens * weights.unsqueeze(-1), dim=2)
        return aggregated, weights


class MachineAdapter(nn.Module):
    """Bottleneck adapter for domain adaptation."""
    def __init__(self, d_model: int = D_MODEL, bottleneck: int = 16):
        super().__init__()
        self.down = nn.Linear(d_model, bottleneck)
        self.up   = nn.Linear(bottleneck, d_model)
        self.norm = nn.LayerNorm(d_model)

    def forward(self, x):
        return self.norm(x + self.up(torch.relu(self.down(x))))


class SensorTokenRULModel(nn.Module):
    """
    Sensor-token RUL prediction model.
    Each sensor at each timestep is a separate token that gets embedded,
    then aggregated across sensors, processed through conv + transformer,
    and decoded to RUL + reconstruction.
    """
    def __init__(self, max_sensors: int, seq_len: int = SEQ_LEN,
                 d_model: int = D_MODEL, nhead: int = N_HEAD,
                 num_layers: int = NUM_LAYERS, dropout: float = DROPOUT,
                 health_dim: int = HEALTH_DIM):
        super().__init__()
        self.max_sensors = max_sensors
        self.seq_len = seq_len

        # Online normalization layer (mean/std loaded from state_dict)
        self.norm_layer = OnlineSensorNorm(max_sensors=max_sensors)

        # Token embedding components
        self.sensor_embed  = nn.Embedding(max_sensors + 1, 24)
        self.value_proj    = nn.Linear(1, 24)
        self.gap_proj      = nn.Linear(1, 8)
        self.quality_embed = nn.Embedding(8, 8)
        # Fuse: id_emb(24) + val_emb(24) + gap_emb(8) + qual_emb(8) + mask_feat(1) = 65
        self.token_fusion  = nn.Linear(24 + 24 + 8 + 8 + 1, d_model)

        # Sensor aggregation
        self.sensor_agg = MaskedGatedAggregator(d_model)

        # Operating-settings gating
        self.op_proj = nn.Sequential(
            nn.Linear(len(OP_COLS), d_model),
            nn.GELU(),
            nn.Linear(d_model, d_model),
        )
        self.op_gate = nn.Sequential(
            nn.Linear(d_model * 2, d_model),
            nn.GELU(),
            nn.Linear(d_model, d_model),
            nn.Sigmoid(),
        )

        # Dilated Conv stack
        self.conv1 = nn.Conv1d(d_model, d_model, kernel_size=3, padding=1)
        self.norm1 = nn.GroupNorm(1, d_model)
        self.conv2 = nn.Conv1d(d_model, d_model, kernel_size=3, padding=2, dilation=2)
        self.norm2 = nn.GroupNorm(1, d_model)
        self.conv3 = nn.Conv1d(d_model, d_model, kernel_size=3, padding=4, dilation=4)
        self.norm3 = nn.GroupNorm(1, d_model)
        self.relu  = nn.ReLU()

        # Positional encoding
        pe = torch.zeros(seq_len, d_model)
        position = torch.arange(0, seq_len, dtype=torch.float32).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer("pos_encoder", pe.unsqueeze(0))

        # Transformer encoder
        enc_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dim_feedforward=d_model * 4,
            dropout=dropout, batch_first=True, norm_first=True
        )
        self.transformer = nn.TransformerEncoder(enc_layer, num_layers=num_layers, enable_nested_tensor=False)
        self.adapter = MachineAdapter(d_model=d_model)

        # Temporal attention pooling
        self.temporal_attn = nn.Sequential(nn.Linear(d_model, 128), nn.GELU(), nn.Linear(128, 1))

        # Health embedding + RUL head
        self.health_embedding = nn.Sequential(nn.Linear(d_model, health_dim), nn.GELU(), nn.Dropout(dropout))
        self.rul_head = nn.Linear(health_dim, 2)

        # Reconstruction decoder (per-timestep → sensor values)
        self.decoder = nn.Sequential(
            nn.Linear(d_model, d_model),
            nn.GELU(),
            nn.Linear(d_model, max_sensors),
        )

    def forward(self, sensor_ids, sensor_values, sensor_mask,
                sensor_time_gap, sensor_quality, operating_settings=None):
        # ── Token embedding ────────────────────────────────────────────
        sensor_values_norm = self.norm_layer(sensor_values)

        id_emb   = self.sensor_embed(sensor_ids)
        val_emb  = self.value_proj(sensor_values_norm.unsqueeze(-1))
        gap_emb  = self.gap_proj(sensor_time_gap.unsqueeze(-1))
        qual_emb = self.quality_embed(sensor_quality.long().clamp(min=0, max=7))
        mask_feat = sensor_mask.unsqueeze(-1)

        tokens = torch.cat([id_emb, val_emb, gap_emb, qual_emb, mask_feat], dim=-1)
        tokens = self.token_fusion(tokens)
        tokens = tokens * sensor_mask.unsqueeze(-1)

        # ── Sensor aggregation ─────────────────────────────────────────
        x, sensor_weights = self.sensor_agg(tokens, sensor_mask)  # (B, T, D)

        # ── Operating-settings gating (optional) ───────────────────────
        if operating_settings is not None:
            op_emb = self.op_proj(operating_settings)       # (B, T, D)
            gate   = self.op_gate(torch.cat([x, op_emb], dim=-1))  # (B, T, D)
            x      = x * gate + op_emb * (1 - gate)

        # ── Dilated Conv ───────────────────────────────────────────────
        x_in = x.permute(0, 2, 1)
        res1 = self.relu(self.norm1(self.conv1(x_in)))
        res2 = self.relu(self.norm2(self.conv2(res1)) + res1)
        h    = self.relu(self.norm3(self.conv3(res2)) + res2)
        h    = h.permute(0, 2, 1)

        # ── Transformer + adapter ──────────────────────────────────────
        h = h + self.pos_encoder[:, :h.shape[1], :]
        h = self.transformer(h)
        h = self.adapter(h)

        # ── Temporal attention pooling ─────────────────────────────────
        attn_scores  = self.temporal_attn(h).squeeze(-1)
        attn_weights = torch.softmax(attn_scores, dim=1)   # (B, T)
        context      = torch.sum(attn_weights.unsqueeze(-1) * h, dim=1)  # (B, D)

        # ── RUL prediction ─────────────────────────────────────────────
        health  = self.health_embedding(context)
        out     = self.rul_head(health)
        pred_rul = torch.relu(out[:, 0])
        log_var  = out[:, 1]

        # ── Reconstruction ─────────────────────────────────────────────
        reconstruction = self.decoder(h)  # (B, T, max_sensors)

        return pred_rul, log_var, reconstruction, {
            "health": health,
            "temporal_attn": attn_weights,
            "temporal_hidden": h,
        }


# ==========================================
# 4. FASTAPI APP & MODEL LOADING
# ==========================================
app = FastAPI(title="SOTA Predictive Maintenance API", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bundle_data:       Optional[dict] = None
ensemble_models:   list           = []
regime_kmeans      = None           # KMeans for default dataset (FD001)
regime_scalers:    dict           = {}  # {regime_id: StandardScaler}
global_scaler      = None           # Global StandardScaler for sensor columns


def load_deploy_bundle():
    """Load the deploy_bundle.pt and initialise all runtime state."""
    global bundle_data, ensemble_models
    global regime_kmeans, regime_scalers, global_scaler
    global REGISTRY_SENSOR_ORDER, REGISTRY_SENSOR_IDS
    global COMPONENT_MAP, CALIBRATION_STATS, RISK_THRESHOLDS
    global RUL_CAP, SEQ_LEN, D_MODEL, N_HEAD, NUM_LAYERS, DROPOUT, HEALTH_DIM

    current_dir = os.path.dirname(os.path.abspath(__file__))
    model_path  = os.path.join(current_dir, 'deploy_bundle.pt')

    if not os.path.exists(model_path):
        raise RuntimeError(f"{model_path} not found! Place it in the backend directory.")

    bundle = torch.load(model_path, map_location=device, weights_only=False)
    bundle_data = bundle

    # ── Extract hyperparameters ────────────────────────────────────────
    hp = bundle['model_hyperparameters']
    RUL_CAP    = hp.get('RUL_CAP', 125)
    SEQ_LEN    = hp.get('SEQ_LEN', 60)
    D_MODEL    = hp.get('D_MODEL', 128)
    N_HEAD     = hp.get('N_HEAD', 4)
    NUM_LAYERS = hp.get('NUM_LAYERS', 4)
    DROPOUT    = hp.get('DROPOUT', 0.15)
    HEALTH_DIM = 96  # derived from health_embedding.0.weight shape

    # ── Sensor registry ────────────────────────────────────────────────
    REGISTRY_SENSOR_ORDER = hp['REGISTRY_SENSOR_ORDER']
    REGISTRY_SENSOR_IDS   = hp['REGISTRY_SENSOR_IDS']

    # ── Component map ──────────────────────────────────────────────────
    pp = bundle['preprocessing']
    COMPONENT_MAP = pp.get('component_map', {})
    if not COMPONENT_MAP:
        # Fallback CMAPSS component map mapping sensor names to components
        COMPONENT_MAP = {
            "HPC (High Pressure Compressor)": ["sensor_2", "sensor_3", "sensor_11"],
            "LPT (Low Pressure Turbine)": ["sensor_4", "sensor_13", "sensor_14", "sensor_15"],
            "Fan & Bypass": ["sensor_8", "sensor_9", "sensor_12"],
            "Combustor & Core": ["sensor_7", "sensor_17", "sensor_20", "sensor_21"]
        }

    # ── Calibration & risk ─────────────────────────────────────────────
    CALIBRATION_STATS = bundle.get('calibration')
    RISK_THRESHOLDS   = bundle.get('risk_thresholds', {})

    # ── Preprocessing objects (default to FD002 to match mock data) ────────
    default_dataset = 'FD002'
    regime_kmeans   = pp['regime_models'].get(default_dataset)
    regime_scalers  = pp['regime_scalers'].get(default_dataset, {})
    global_scaler   = pp['regime_global_scalers'].get(default_dataset)

    # sklearn's KMeans.predict expects float64 internally
    if regime_kmeans is not None:
        regime_kmeans.cluster_centers_ = regime_kmeans.cluster_centers_.astype(np.float64)

    # ── Rebuild ensemble models ────────────────────────────────────────
    ensemble_artifact = bundle['ensemble_artifact']
    max_sensors = int(hp['REGISTERED_SENSOR_COUNT'])

    for member in ensemble_artifact['members']:
        model = SensorTokenRULModel(
            max_sensors=max_sensors,
            seq_len=SEQ_LEN,
            d_model=D_MODEL,
            nhead=N_HEAD,
            num_layers=NUM_LAYERS,
            dropout=DROPOUT,
            health_dim=HEALTH_DIM,
        ).to(device)
        model.load_state_dict(member['state_dict'], strict=True)
        model.eval()
        ensemble_models.append(model)

    print(f"[OK] API Initialized | {len(ensemble_models)} ensemble models | "
          f"{max_sensors} sensors | SEQ_LEN={SEQ_LEN} | device={device}")


@app.on_event("startup")
async def startup_event():
    load_deploy_bundle()


# ==========================================
# 5. PREPROCESSING PIPELINE
#    (token-based — no manual feature eng)
# ==========================================
def _remap_op_cols(df: pd.DataFrame) -> pd.DataFrame:
    """Rename op_setting_* → setting_* if the API client uses the old names."""
    rename = {old: new for old, new in OP_COLS_API_MAP.items() if old in df.columns}
    if rename:
        df = df.rename(columns=rename)
    return df


def _apply_regime_scaling(df: pd.DataFrame) -> pd.DataFrame:
    """Apply KMeans regime detection + per-regime StandardScaler normalisation."""
    if regime_kmeans is None:
        return df

    # Ensure op columns exist
    for c in OP_COLS:
        if c not in df.columns:
            df[c] = 0.0

    df['regime'] = regime_kmeans.predict(df[OP_COLS].values.astype(np.float64))

    for regime_id, scaler in regime_scalers.items():
        mask = df['regime'] == regime_id
        if mask.sum() > 0:
            df.loc[mask, REGISTRY_SENSOR_ORDER] = scaler.transform(
                df.loc[mask, REGISTRY_SENSOR_ORDER]
            )

    return df


def _build_token_tensors(df: pd.DataFrame, seq_len: int = None):
    """
    Convert a preprocessed DataFrame into the 5 tensor inputs
    expected by SensorTokenRULModel.

    Returns dict with keys:
        sensor_ids, sensor_values, sensor_mask, sensor_time_gap,
        sensor_quality, operating_settings
    each of shape (1, T, S) or (1, T, 3) for op settings.
    """
    if seq_len is None:
        seq_len = SEQ_LEN

    n_sensors = len(REGISTRY_SENSOR_ORDER)
    n_rows    = len(df)

    # Extract raw sensor values
    values = df[REGISTRY_SENSOR_ORDER].values.astype(np.float32)  # (n_rows, S)
    masks  = np.ones_like(values, dtype=np.float32)
    quality = np.ones_like(values, dtype=np.int64)

    # Compute time gaps (simple: all 0 since data is dense / regular)
    gaps = np.zeros_like(values, dtype=np.float32)

    # Pad or truncate to seq_len
    if n_rows < seq_len:
        pad_len = seq_len - n_rows
        values  = np.pad(values,  ((pad_len, 0), (0, 0)), mode='edge')
        masks   = np.pad(masks,   ((pad_len, 0), (0, 0)), mode='edge')
        quality = np.pad(quality, ((pad_len, 0), (0, 0)), mode='edge')
        gaps    = np.pad(gaps,    ((pad_len, 0), (0, 0)), mode='constant')
    else:
        values  = values[-seq_len:]
        masks   = masks[-seq_len:]
        quality = quality[-seq_len:]
        gaps    = gaps[-seq_len:]

    # Build sensor IDs (same for every timestep)
    sensor_ids_row = np.array([REGISTRY_SENSOR_IDS[s] for s in REGISTRY_SENSOR_ORDER], dtype=np.int64)
    sensor_ids = np.tile(sensor_ids_row[None, :], (seq_len, 1))  # (T, S)

    # Operating settings
    op_values = np.zeros((seq_len, len(OP_COLS)), dtype=np.float32)
    for i, col in enumerate(OP_COLS):
        if col in df.columns:
            col_vals = df[col].values.astype(np.float32)
            if len(col_vals) < seq_len:
                col_vals = np.pad(col_vals, (seq_len - len(col_vals), 0), mode='edge')
            else:
                col_vals = col_vals[-seq_len:]
            op_values[:, i] = col_vals

    return {
        "sensor_ids":          torch.tensor(sensor_ids[np.newaxis],   dtype=torch.long,    device=device),
        "sensor_values":       torch.tensor(values[np.newaxis],       dtype=torch.float32, device=device),
        "sensor_mask":         torch.tensor(masks[np.newaxis],        dtype=torch.float32, device=device),
        "sensor_time_gap":     torch.tensor(gaps[np.newaxis],         dtype=torch.float32, device=device),
        "sensor_quality":      torch.tensor(quality[np.newaxis],      dtype=torch.long,    device=device),
        "operating_settings":  torch.tensor(op_values[np.newaxis],    dtype=torch.float32, device=device),
    }

# ==========================================
# 6. EXPLAINABILITY
#    (reconstruction-based + leave-one-out)
# ==========================================
def _per_sensor_recon_scores(sensor_values, reconstruction, sensor_mask):
    """Per-sensor reconstruction MSE, shape (B, S)."""
    sq = (reconstruction - sensor_values) ** 2
    masked_sq = sq * sensor_mask
    counts = sensor_mask.sum(dim=1).clamp(min=1.0)
    return masked_sq.sum(dim=1) / counts


def _leave_one_out_impact(model, batch_tensors):
    """
    Mask each sensor one at a time and measure how much the
    predicted RUL changes. Returns {sensor_name: abs_rul_change}.
    """
    with torch.no_grad():
        base_pred, _, _, _ = model(
            batch_tensors["sensor_ids"],
            batch_tensors["sensor_values"],
            batch_tensors["sensor_mask"],
            batch_tensors["sensor_time_gap"],
            batch_tensors["sensor_quality"],
            batch_tensors.get("operating_settings"),
        )
    base_val = float(base_pred[0].item())

    scores = {}
    for s_idx, sensor_name in enumerate(REGISTRY_SENSOR_ORDER):
        masked = {k: (v.clone() if torch.is_tensor(v) else deepcopy(v))
                  for k, v in batch_tensors.items()}
        masked["sensor_mask"][:, :, s_idx] = 0.0
        masked["sensor_quality"][:, :, s_idx] = 0

        with torch.no_grad():
            masked_pred, _, _, _ = model(
                masked["sensor_ids"],
                masked["sensor_values"],
                masked["sensor_mask"],
                masked["sensor_time_gap"],
                masked["sensor_quality"],
                masked.get("operating_settings"),
            )
        scores[sensor_name] = abs(float(masked_pred[0].item()) - base_val)
    return scores


def _safe_z(value, stats_dict):
    """Z-score a value against calibration stats."""
    if stats_dict is None:
        return 0.0
    std  = float(max(stats_dict.get("std", 1e-6), 1e-6))
    mean = float(stats_dict.get("mean", 0.0))
    return float((value - mean) / std)


def _aggregate_to_components(sensor_scores: Dict[str, float]) -> Dict[str, float]:
    """Average sensor scores into component-level scores."""
    comp_scores = {}
    for comp, sensors in COMPONENT_MAP.items():
        vals = [sensor_scores.get(s, 0.0) for s in sensors]
        comp_scores[comp] = float(np.mean(vals)) if vals else 0.0
    return comp_scores


def _build_sensor_explanations(
    fused_scores: Dict[str, float],
    predicted_rul: float,
) -> List[SensorExplanation]:
    """Build top-2 SensorExplanation objects from fused importance scores."""
    # Sort by importance descending
    total = sum(fused_scores.values()) or 1.0
    sorted_sensors = sorted(fused_scores.items(), key=lambda kv: kv[1], reverse=True)

    explanations = []
    for sensor_name, score in sorted_sensors[:2]:
        importance = round(score / total, 4)
        pct = round(importance * 100, 1)
        rul_int = int(predicted_rul)

        # Use z-score to determine direction
        z = 0.0
        if CALIBRATION_STATS and 'sensors' in CALIBRATION_STATS:
            z = _safe_z(score, CALIBRATION_STATS['sensors'].get(sensor_name))

        # Higher z-score = more anomalous = degrading
        is_healthy = z < 1.0
        direction_str = "raises_rul" if is_healthy else "lowers_rul"

        if is_healthy:
            sentence = (
                f"{sensor_name} is operating normally and accounts for {pct}% of the "
                f"factors supporting the {rul_int}-cycle life estimate."
            )
        else:
            sentence = (
                f"{sensor_name} shows signs of degradation and is the {pct}% contributor "
                f"pulling the predicted life down to {rul_int} cycles."
            )

        explanations.append(SensorExplanation(
            sensor=sensor_name,
            importance=importance,
            direction=direction_str,
            plain_english=sentence,
        ))

    return explanations


# ==========================================
# 7. /predict
# ==========================================
@app.post("/predict", response_model=InferenceResponse)
async def predict_rul(request: InferenceRequest):
    if not request.flight_history:
        raise HTTPException(400, "flight_history cannot be empty.")

    # ── 1. Build DataFrame & remap columns ─────────────────────────────
    df = pd.DataFrame(request.flight_history)
    df = _remap_op_cols(df)

    # Ensure all registered sensors are present
    for s in REGISTRY_SENSOR_ORDER:
        if s not in df.columns:
            raise HTTPException(400, f"Missing sensor column: {s}")

    # ── 2. Apply regime scaling ────────────────────────────────────────
    df = _apply_regime_scaling(df)

    # ── 3. Build token tensors ─────────────────────────────────────────
    batch = _build_token_tensors(df)

    # ── 4. Ensemble inference ──────────────────────────────────────────
    ensemble_preds, ensemble_vars, ensemble_anoms = [], [], []
    ensemble_attn = []

    with torch.no_grad():
        for model in ensemble_models:
            pred_rul, log_var, reconstruction, info = model(
                batch["sensor_ids"],
                batch["sensor_values"],
                batch["sensor_mask"],
                batch["sensor_time_gap"],
                batch["sensor_quality"],
                batch.get("operating_settings"),
            )
            ensemble_preds.append(float(np.clip(pred_rul.cpu().item(), 0, RUL_CAP)))
            ensemble_vars.append(float(torch.exp(log_var).cpu().item()))

            # Anomaly = mean reconstruction error
            recon_err = float(torch.mean(
                (reconstruction - batch["sensor_values"]) ** 2
                * batch["sensor_mask"]
            ).cpu().item())
            ensemble_anoms.append(recon_err)
            ensemble_attn.append(info["temporal_attn"].squeeze(0).cpu().numpy())

    final_rul = float(np.mean(ensemble_preds))
    margin    = float(2 * np.sqrt(np.mean(ensemble_vars) + np.var(ensemble_preds)))
    anomaly   = float(np.mean(ensemble_anoms))

    # Peak attention cycle — 0-indexed within the last SEQ_LEN cycles
    mean_attn       = np.mean(ensemble_attn, axis=0)
    attn_peak_cycle = int(np.argmax(mean_attn))

    # ── 5. Explainability ──────────────────────────────────────────────
    explain_model = ensemble_models[0]

    # Reconstruction scores
    with torch.no_grad():
        _, _, recon, _ = explain_model(
            batch["sensor_ids"],
            batch["sensor_values"],
            batch["sensor_mask"],
            batch["sensor_time_gap"],
            batch["sensor_quality"],
            batch.get("operating_settings"),
        )
    recon_scores_tensor = _per_sensor_recon_scores(
        batch["sensor_values"], recon, batch["sensor_mask"]
    )
    recon_scores = {
        sensor: float(recon_scores_tensor[0, idx].item())
        for idx, sensor in enumerate(REGISTRY_SENSOR_ORDER)
    }

    # Leave-one-out RUL impact
    impact_scores = _leave_one_out_impact(explain_model, batch)

    # Fused scores
    fused_scores = {
        s: recon_scores.get(s, 0.0) + impact_scores.get(s, 0.0)
        for s in REGISTRY_SENSOR_ORDER
    }

    top_sensors = _build_sensor_explanations(fused_scores, final_rul)

    # ── 6. Status label ────────────────────────────────────────────────
    anomaly_z = 0.0
    if CALIBRATION_STATS and 'global' in CALIBRATION_STATS:
        comp_scores = _aggregate_to_components(fused_scores)
        global_anomaly = float(np.mean(list(comp_scores.values()))) if comp_scores else 0.0
        anomaly_z = _safe_z(global_anomaly, CALIBRATION_STATS['global'])

    if final_rul <= 30 or anomaly_z >= 2.0:
        status = "CRITICAL — MAINTENANCE REQUIRED"
    elif final_rul <= 60 or anomaly_z >= 1.0:
        status = "WARNING — DEGRADATION DETECTED"
    else:
        status = "HEALTHY"

    # Infer risk
    if final_rul <= 30 or anomaly_z >= 2.0:
        risk_level = "high"
    elif final_rul <= 60 or anomaly_z >= 1.0:
        risk_level = "medium"
    else:
        risk_level = "low"

    # Infer confidence note
    uncertainty_sigma = round(np.sqrt(np.mean(ensemble_vars)), 2)
    supported_components = len(top_sensors)
    if uncertainty_sigma >= 10.0:
        confidence_note = "High predictive uncertainty; use this output as a screening signal only."
    elif supported_components == 0:
        confidence_note = "Low anomaly support; attribution remains weak and proxy-based."
    elif anomaly_z >= 2.0:
        confidence_note = "Strong anomaly signal; attribution is still a proxy-based ranking, not confirmed diagnosis."
    else:
        confidence_note = "Moderate confidence: proxy-based ranking supported by calibrated anomaly evidence."

    # Infer recommendation
    if risk_level == "high":
        recommendation = "Immediate inspection is recommended; verify sensor integrity and inspect the top-ranked components."
    elif risk_level == "medium":
        recommendation = "Schedule inspection soon and monitor the top-ranked components for worsening behavior."
    else:
        recommendation = "Continue monitoring; no urgent intervention is indicated from the current evidence."

    # Build report text
    comp_scores = _aggregate_to_components(fused_scores)
    top_comps = sorted(comp_scores.items(), key=lambda x: x[1], reverse=True)[:2]
    components_text = ", and ".join([f"**{k}** (Severity: {v:.2f})" for k, v in top_comps]) if top_comps else "none"

    sensors = ", ".join([s.sensor for s in top_sensors[:5]]) or "none"
    report_text = "\n\n".join([
        f"Asset **{request.engine_id}** (current reading cycle) has predicted RUL **{final_rul:.2f}**.",
        f"Uncertainty sigma is **{uncertainty_sigma:.2f}**; anomaly z-score is **{anomaly_z:.2f}**; risk level is **{risk_level.capitalize()}**.",
        f"Failing Part Detection / Suspected anomaly source:\n{components_text}",
        f"Top contributing sensors: **{sensors}**.",
        f"Recommendation: **{recommendation}**",
        f"Confidence note: **{confidence_note}**"
    ])

    import math
    suspected_components = []
    for k, v in top_comps:
        # Asymptotic mapping to keep severity between 0-100%
        severity_pct = (1.0 - math.exp(-v / 400.0)) * 100.0
        suspected_components.append(f"{k} (Severity: {severity_pct:.1f}%)")
    
    return InferenceResponse(
        engine_id=request.engine_id,
        predicted_rul=round(final_rul, 1),
        confidence_margin=round(margin, 2),
        anomaly_score=round(anomaly, 4),
        status=status,
        top_sensors=top_sensors,
        attn_peak_cycle=attn_peak_cycle,
        risk_level=risk_level,
        recommendation=recommendation,
        confidence_note=confidence_note,
        report_text=report_text,
        uncertainty_sigma=round(uncertainty_sigma, 2),
        anomaly_z=round(anomaly_z, 2),
        suspected_components=suspected_components
    )

# ==========================================
# 8. /detect_changepoint
# ==========================================
@app.post("/detect_changepoint")
async def detect_changepoint(request: InferenceRequest):
    if len(request.flight_history) < 10:
        raise HTTPException(400, "Need at least 10 flights to establish a baseline.")

    df = pd.DataFrame(request.flight_history)
    df = _remap_op_cols(df)

    # Ensure sensors present
    for s in REGISTRY_SENSOR_ORDER:
        if s not in df.columns:
            raise HTTPException(400, f"Missing sensor column: {s}")

    df = _apply_regime_scaling(df)

    # Build per-flight sliding windows
    num_flights = len(df)
    n_sensors   = len(REGISTRY_SENSOR_ORDER)

    values_full = df[REGISTRY_SENSOR_ORDER].values.astype(np.float32)
    masks_full  = np.ones_like(values_full, dtype=np.float32)
    quality_full = np.ones_like(values_full, dtype=np.int64)

    # Op settings
    op_full = np.zeros((num_flights, len(OP_COLS)), dtype=np.float32)
    for i, col in enumerate(OP_COLS):
        if col in df.columns:
            op_full[:, i] = df[col].values.astype(np.float32)

    sensor_ids_row = np.array([REGISTRY_SENSOR_IDS[s] for s in REGISTRY_SENSOR_ORDER], dtype=np.int64)

    # Build windows
    all_ids, all_vals, all_masks, all_gaps, all_qual, all_ops = [], [], [], [], [], []

    for end_idx in range(num_flights):
        start_idx = max(0, end_idx - SEQ_LEN + 1)
        wv = values_full[start_idx:end_idx + 1]
        wm = masks_full[start_idx:end_idx + 1]
        wq = quality_full[start_idx:end_idx + 1]
        wo = op_full[start_idx:end_idx + 1]
        L = wv.shape[0]

        sv = np.zeros((SEQ_LEN, n_sensors), dtype=np.float32)
        sm = np.zeros((SEQ_LEN, n_sensors), dtype=np.float32)
        sq = np.zeros((SEQ_LEN, n_sensors), dtype=np.int64)
        sg = np.zeros((SEQ_LEN, n_sensors), dtype=np.float32)
        so = np.zeros((SEQ_LEN, len(OP_COLS)), dtype=np.float32)

        sv[-L:] = wv
        sm[-L:] = wm
        sq[-L:] = wq
        so[-L:] = wo

        si = np.tile(sensor_ids_row[None, :], (SEQ_LEN, 1))

        all_ids.append(si)
        all_vals.append(sv)
        all_masks.append(sm)
        all_gaps.append(sg)
        all_qual.append(sq)
        all_ops.append(so)

    batch_ids  = torch.tensor(np.array(all_ids),  dtype=torch.long,    device=device)
    batch_vals = torch.tensor(np.array(all_vals),  dtype=torch.float32, device=device)
    batch_mask = torch.tensor(np.array(all_masks), dtype=torch.float32, device=device)
    batch_gap  = torch.tensor(np.array(all_gaps),  dtype=torch.float32, device=device)
    batch_qual = torch.tensor(np.array(all_qual),  dtype=torch.long,    device=device)
    batch_ops  = torch.tensor(np.array(all_ops),   dtype=torch.float32, device=device)

    ensemble_anomalies = np.zeros(num_flights)
    ensemble_ruls      = np.zeros(num_flights)

    with torch.no_grad():
        for model in ensemble_models:
            pred_rul, _, recon, _ = model(
                batch_ids, batch_vals, batch_mask, batch_gap, batch_qual, batch_ops
            )
            ensemble_ruls += np.clip(pred_rul.cpu().numpy().flatten(), 0, RUL_CAP)
            recon_err = ((recon - batch_vals) ** 2 * batch_mask).mean(dim=(1, 2)).cpu().numpy()
            ensemble_anomalies += recon_err

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
                f"(RUL dropped to {ensemble_ruls[cycle]:.1f})"
            )
            break
        if cycle > 10 and ensemble_anomalies[cycle] > anomaly_threshold:
            change_point_cycle = cycle + 1
            trigger_reason = (
                f"Anomaly spike detected "
                f"(score: {ensemble_anomalies[cycle]:.4f})"
            )
            break

    return {
        "engine_id":              request.engine_id,
        "total_flights_analyzed": num_flights,
        "is_impaired":            change_point_cycle != -1,
        "impaired_flight_cycle":  change_point_cycle if change_point_cycle != -1 else None,
        "transition_reason":      trigger_reason,
    }

# ==========================================
# 9. ENTRYPOINT
# ==========================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)