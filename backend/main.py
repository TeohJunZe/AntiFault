import os
import torch
import torch.nn as nn
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.cluster import KMeans
from typing import List, Dict

# ==========================================
# 1. CONSTANTS & CONFIGURATION
# ==========================================
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
RUL_CAP = 125
SEQ_LEN = 40
D_MODEL = 96
N_HEAD = 3
NUM_LAYERS = 3
DROPOUT = 0.2
HEALTH_DIM = 64

op_cols = ['op_setting_1', 'op_setting_2', 'op_setting_3']
all_sensor_cols = [f'sensor_{i}' for i in range(1, 22)]

# ==========================================
# 2. PYDANTIC SCHEMAS (API Contracts)
# ==========================================
class InferenceRequest(BaseModel):
    engine_id: str
    # Expects a list of dictionaries, where each dict is a flight cycle's raw sensor data
    flight_history: List[Dict[str, float]] 

class InferenceResponse(BaseModel):
    engine_id: str
    predicted_rul: float
    confidence_margin: float # The +/- 2 Sigma bound
    anomaly_score: float
    status: str

# ==========================================
# 3. FASTAPI APP & MODEL LOADING
# ==========================================
app = FastAPI(title="SOTA Predictive Maintenance API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Globals to hold our loaded models
pipeline_data = None
ensemble_models = []
important_sensors = []
feature_cols = []

def load_production_core():
    global pipeline_data, ensemble_models, important_sensors, feature_cols
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(current_dir, 'production_core.pt')
    
    if not os.path.exists(model_path):
        raise RuntimeError(f"{model_path} not found! Place it in the backend directory.")
        
    package = torch.load(model_path, map_location=device, weights_only=False)
    pipeline_data = package['pipeline']
    important_sensors = pipeline_data['sensors']
    
    # Rebuild feature column names exactly as trained
    feature_cols = important_sensors + [f'{c}_diff' for c in important_sensors] + \
                   [f'{c}_mean_{w}' for c in important_sensors for w in [5, 10, 20, 30]] + \
                   [f'{c}_std_{w}' for c in important_sensors for w in [5, 10, 20, 30]] + \
                   [f'{c}_slope_{w}' for c in important_sensors for w in [10, 20]]
                   
    # Define Architecture
    class Generalized_PM_Architecture(nn.Module):
        def __init__(self, num_features=len(feature_cols), d_model=D_MODEL, nhead=N_HEAD, num_layers=NUM_LAYERS, dropout=DROPOUT):
            super().__init__()
            self.conv1 = nn.Conv1d(num_features, d_model, kernel_size=3, padding=1, dilation=1)
            self.norm1 = nn.GroupNorm(1, d_model) 
            self.conv2 = nn.Conv1d(d_model, d_model, kernel_size=3, padding=2, dilation=2)
            self.norm2 = nn.GroupNorm(1, d_model)
            self.conv3 = nn.Conv1d(d_model, d_model, kernel_size=3, padding=4, dilation=4)
            self.norm3 = nn.GroupNorm(1, d_model)
            self.relu = nn.ReLU()

            pe = torch.zeros(SEQ_LEN, d_model)
            position = torch.arange(0, SEQ_LEN, dtype=torch.float).unsqueeze(1)
            div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-np.log(10000.0) / d_model))
            pe[:, 0::2] = torch.sin(position * div_term)
            pe[:, 1::2] = torch.cos(position * div_term)
            self.register_buffer('pos_encoder', pe.unsqueeze(0)) 

            encoder_layer = nn.TransformerEncoderLayer(d_model=d_model, nhead=nhead, dim_feedforward=d_model*4, dropout=dropout, batch_first=True, norm_first=True)
            self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers, enable_nested_tensor=False)
            self.attn = nn.Sequential(nn.Linear(d_model, 128), nn.GELU(), nn.Linear(128, 1))
            self.health_embedding = nn.Sequential(nn.Linear(d_model, HEALTH_DIM), nn.GELU(), nn.Dropout(dropout))
            self.rul_head = nn.Linear(HEALTH_DIM, 2) 
            self.decoder_expansion = nn.Linear(HEALTH_DIM, d_model)
            self.decoder_upsample = nn.ConvTranspose1d(in_channels=d_model, out_channels=d_model, kernel_size=SEQ_LEN)
            self.decoder_conv = nn.Sequential(nn.Conv1d(d_model, d_model, kernel_size=3, padding=1), nn.GELU(), nn.Conv1d(d_model, num_features, kernel_size=3, padding=1))

        def forward(self, x):
            x_in = x.permute(0, 2, 1) 
            res1 = self.relu(self.norm1(self.conv1(x_in)))
            res2 = self.relu(self.norm2(self.conv2(res1)) + res1) 
            h    = self.relu(self.norm3(self.conv3(res2)) + res2) 
            h = h.permute(0, 2, 1) + self.pos_encoder
            h = self.transformer(h)
            attn_scores = self.attn(h).squeeze(-1) 
            attn_weights = torch.softmax(attn_scores, dim=1) 
            context_vector = torch.sum(attn_weights.unsqueeze(-1) * h, dim=1) 
            health_idx = self.health_embedding(context_vector)
            rul_out = self.rul_head(health_idx)
            pred_rul = self.relu(rul_out[:, 0]) 
            log_var = rul_out[:, 1]             
            dec_h = self.decoder_upsample(self.decoder_expansion(health_idx).unsqueeze(-1))       
            reconstruction = self.decoder_conv(dec_h).permute(0, 2, 1) 
            return pred_rul, log_var, reconstruction, health_idx

    for weights in package['ensemble_weights']:
        model = Generalized_PM_Architecture(num_features=len(feature_cols)).to(device)
        model.load_state_dict(weights)
        model.eval()
        ensemble_models.append(model)
        
    print("✅ API Core Successfully Initialized!")

@app.on_event("startup")
async def startup_event():
    load_production_core()

# ==========================================
# 4. MATH & PREPROCESSING PIPELINE
# ==========================================
def _rolling_slope_fast(series, w):
    x = np.arange(w, dtype=np.float32)
    x -= x.mean()
    x_var = (x ** 2).sum()
    def _slope(arr):
        arr = arr - arr.mean()
        return (x[:len(arr)] * arr).sum() / (x_var + 1e-8)
    return series.rolling(w, min_periods=w).apply(_slope, raw=True).fillna(0)

def extract_features(df):
    df[important_sensors] = df[important_sensors].ewm(span=5, adjust=False).mean().astype(np.float32)
    new_features = {}
    for col in important_sensors:
        new_features[f'{col}_diff'] = df[col].diff().fillna(0).astype(np.float32)
        for w in [5, 10, 20, 30]:
            new_features[f'{col}_mean_{w}'] = df[col].rolling(w, min_periods=1).mean().astype(np.float32)
            new_features[f'{col}_std_{w}'] = df[col].rolling(w, min_periods=1).std().fillna(0).astype(np.float32)
        for w in [10, 20]:
            new_features[f'{col}_slope_{w}'] = _rolling_slope_fast(df[col], w).astype(np.float32)
    return pd.concat([df, pd.DataFrame(new_features, index=df.index)], axis=1).fillna(0)

# ==========================================
# 5. INFERENCE ENDPOINT
# ==========================================
@app.post("/predict", response_model=InferenceResponse)
async def predict_rul(request: InferenceRequest):
    if len(request.flight_history) == 0:
        raise HTTPException(status_code=400, detail="Flight history cannot be empty.")
        
    # 1. Convert JSON to DataFrame
    df = pd.DataFrame(request.flight_history)
    
    # Check for missing columns
    required_cols = op_cols + all_sensor_cols
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns in payload: {missing}")

    # 2. Apply K-Means Regime & Scalers
    kmeans = pipeline_data['kmeans']
    scalers = pipeline_data['scalers']
    df['regime'] = kmeans.predict(df[op_cols])
    
    for regime in range(6):
        if regime in scalers:
            mask = df['regime'] == regime
            if mask.sum() > 0:
                df.loc[mask, important_sensors] = scalers[regime].transform(df.loc[mask, important_sensors])
                
    # 3. Apply Feature Engineering
    df = extract_features(df)
    
    # 4. Create Sequence (Extract last 40 flights, edge-pad if too short)
    data = df[feature_cols].values
    if len(data) < SEQ_LEN:
        pad_size = SEQ_LEN - len(data)
        data = np.pad(data, ((pad_size, 0), (0, 0)), 'edge')
    
    sequence = data[-SEQ_LEN:] # Grab exactly the last 40 steps
    X_tensor = torch.tensor(np.array([sequence]), dtype=torch.float32, device=device)
    
    # 5. Run the Ensemble
    ensemble_preds, ensemble_vars, ensemble_anomalies = [], [], []
    with torch.no_grad():
        for model in ensemble_models:
            pred_rul, log_var, recon, _ = model(X_tensor)
            ensemble_preds.append(np.clip(pred_rul.cpu().numpy().flatten(), 0, RUL_CAP)[0])
            ensemble_vars.append(torch.exp(log_var).cpu().numpy().flatten()[0])
            
            mse = torch.mean((recon - X_tensor)**2, dim=(1, 2)).cpu().numpy()[0]
            ensemble_anomalies.append(mse)
            
    # 6. Aggregate Output Math
    final_rul = float(np.mean(ensemble_preds))
    aleatoric = np.mean(ensemble_vars)
    epistemic = np.var(ensemble_preds)
    margin = float(2 * np.sqrt(aleatoric + epistemic))
    anomaly = float(np.mean(ensemble_anomalies))
    
    # Determine Health Status
    if final_rul <= 50 or anomaly > 1.5:  # Adjust anomaly threshold based on your dataset
        status = "CRITICAL - MAINTENANCE REQUIRED"
    elif final_rul <= 80:
        status = "WARNING - DEGRADATION DETECTED"
    else:
        status = "HEALTHY"

    return InferenceResponse(
        engine_id=request.engine_id,
        predicted_rul=round(final_rul, 1),
        confidence_margin=round(margin, 2),
        anomaly_score=round(anomaly, 4),
        status=status
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)