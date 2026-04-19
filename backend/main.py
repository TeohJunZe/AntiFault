import io
import json
import math
import os
import re
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fine_tune_utils import evaluate_model_ensemble, fine_tune_model, prepare_fine_tune_bundle

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

CURRENT_DIR = Path(__file__).resolve().parent
BASE_BUNDLE_PATH = CURRENT_DIR / "deploy_bundle.pt"
MACHINE_MODELS_DIR = CURRENT_DIR / "machine_models"

bundle_data: Optional[dict] = None
ensemble_models: List[nn.Module] = []
overlay_models_cache: Dict[str, List[nn.Module]] = {}
overlay_metadata_cache: Dict[str, Dict[str, Any]] = {}
regime_kmeans = None
regime_scalers: dict = {}
global_scaler = None
TRAINING_POLICY: Dict[str, Any] = {}
TRANSFER_POLICY: Dict[str, Any] = {}
CRITICAL_RUL_CUTOFF = 60
VERY_LOW_RUL_THRESHOLD = 30
ADAPTER_HEAD_PARAMETER_SHARE_PCT = 0.0


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sanitize_machine_id(machine_id: str) -> str:
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "_", machine_id.strip())
    return sanitized or "unknown-machine"


def _machine_overlay_dir(machine_id: str) -> Path:
    return MACHINE_MODELS_DIR / _sanitize_machine_id(machine_id)


def _machine_overlay_path(machine_id: str) -> Path:
    return _machine_overlay_dir(machine_id) / "model_overlay.pt"


def _machine_metadata_path(machine_id: str) -> Path:
    return _machine_overlay_dir(machine_id) / "metadata.json"


def _machine_upload_path(machine_id: str) -> Path:
    return _machine_overlay_dir(machine_id) / "latest_upload.csv"


def load_deploy_bundle():
    """Load the deploy_bundle.pt and initialise all runtime state."""
    global bundle_data, ensemble_models
    global regime_kmeans, regime_scalers, global_scaler
    global REGISTRY_SENSOR_ORDER, REGISTRY_SENSOR_IDS
    global COMPONENT_MAP, CALIBRATION_STATS, RISK_THRESHOLDS
    global RUL_CAP, SEQ_LEN, D_MODEL, N_HEAD, NUM_LAYERS, DROPOUT, HEALTH_DIM
    global TRAINING_POLICY, TRANSFER_POLICY
    global CRITICAL_RUL_CUTOFF, VERY_LOW_RUL_THRESHOLD, ADAPTER_HEAD_PARAMETER_SHARE_PCT

    MACHINE_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    ensemble_models = []

    if not BASE_BUNDLE_PATH.exists():
        raise RuntimeError(f"{BASE_BUNDLE_PATH} not found! Place it in the backend directory.")

    bundle = torch.load(BASE_BUNDLE_PATH, map_location=device, weights_only=False)
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
    CRITICAL_RUL_CUTOFF = int(hp.get('CRITICAL_RUL_CUTOFF', 60))
    VERY_LOW_RUL_THRESHOLD = int(hp.get('VERY_LOW_RUL_THRESHOLD', 30))

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
    TRAINING_POLICY = bundle.get('training_policy', {})
    TRANSFER_POLICY = bundle.get('transfer_policy', {})

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

    if ensemble_artifact['members']:
        sample_state_dict = ensemble_artifact['members'][0]['state_dict']
        total_params = sum(tensor.numel() for tensor in sample_state_dict.values())
        adapter_head_params = sum(
            tensor.numel()
            for key, tensor in sample_state_dict.items()
            if key.startswith('adapter.') or key.startswith('rul_head.')
        )
        ADAPTER_HEAD_PARAMETER_SHARE_PCT = round((adapter_head_params / max(total_params, 1)) * 100, 4)

    print(f"[OK] API Initialized | {len(ensemble_models)} ensemble models | "
          f"{max_sensors} sensors | SEQ_LEN={SEQ_LEN} | device={device}")


@app.on_event("startup")
async def startup_event():
    load_deploy_bundle()


def _build_model_from_state_dict(state_dict: Dict[str, torch.Tensor]) -> nn.Module:
    model = SensorTokenRULModel(
        max_sensors=len(REGISTRY_SENSOR_ORDER),
        seq_len=SEQ_LEN,
        d_model=D_MODEL,
        nhead=N_HEAD,
        num_layers=NUM_LAYERS,
        dropout=DROPOUT,
        health_dim=HEALTH_DIM,
    ).to(device)
    model.load_state_dict(state_dict, strict=True)
    model.eval()
    return model


def _invalidate_machine_overlay_cache(machine_id: str) -> None:
    overlay_models_cache.pop(machine_id, None)
    overlay_metadata_cache.pop(machine_id, None)


def _load_machine_overlay_metadata(machine_id: str) -> Optional[Dict[str, Any]]:
    if machine_id in overlay_metadata_cache:
        return overlay_metadata_cache[machine_id]

    metadata_path = _machine_metadata_path(machine_id)
    if not metadata_path.exists():
        return None

    with metadata_path.open("r", encoding="utf-8") as metadata_file:
        metadata = json.load(metadata_file)

    overlay_metadata_cache[machine_id] = metadata
    return metadata


def _load_machine_overlay_models(machine_id: str) -> Optional[List[nn.Module]]:
    if machine_id in overlay_models_cache:
        return overlay_models_cache[machine_id]

    overlay_path = _machine_overlay_path(machine_id)
    if not overlay_path.exists():
        return None

    payload = torch.load(overlay_path, map_location=device, weights_only=False)
    models: List[nn.Module] = []
    for member in payload.get("members", []):
        models.append(_build_model_from_state_dict(member["state_dict"]))

    if not models:
        return None

    overlay_models_cache[machine_id] = models
    return models


def _resolve_models_for_engine(engine_id: str) -> List[nn.Module]:
    overlay_models = _load_machine_overlay_models(engine_id)
    return overlay_models or ensemble_models


def _build_fine_tune_config() -> Dict[str, Any]:
    return {
        "registry_sensor_order": REGISTRY_SENSOR_ORDER,
        "registry_sensor_ids": REGISTRY_SENSOR_IDS,
        "op_cols": OP_COLS,
        "coverage_warn_threshold": float(
            TRANSFER_POLICY.get("thresholds", {}).get("missing_sensor_warn_ratio", 0.2)
        ),
        "coverage_reject_threshold": float(
            TRANSFER_POLICY.get("thresholds", {}).get("missing_sensor_reject_ratio", 0.4)
        ),
        "test_ratio": 0.25,
        "val_ratio": 0.20,
        "random_seed": 42,
        "seq_len": SEQ_LEN,
        "batch_size": int(TRANSFER_POLICY.get("fine_tune_batch_size", 96)),
        "stride_high_rul": int(TRAINING_POLICY.get("STRIDE_HIGH_RUL", 4)),
        "stride_mid_rul": int(TRAINING_POLICY.get("STRIDE_MID_RUL", 2)),
        "stride_low_rul": int(TRAINING_POLICY.get("STRIDE_LOW_RUL", 1)),
        "critical_rul_cutoff": int(CRITICAL_RUL_CUTOFF),
        "very_low_rul_threshold": int(VERY_LOW_RUL_THRESHOLD),
        "weight_high_rul": float(TRAINING_POLICY.get("WEIGHT_HIGH_RUL", 1.0)),
        "weight_mid_rul": float(TRAINING_POLICY.get("WEIGHT_MID_RUL", 3.0)),
        "weight_low_rul": float(TRAINING_POLICY.get("WEIGHT_LOW_RUL", 5.0)),
        "mid_rul_threshold": float(CRITICAL_RUL_CUTOFF),
        "low_rul_threshold": float(VERY_LOW_RUL_THRESHOLD),
        "mid_rul_weight": float(TRAINING_POLICY.get("MID_RUL_WEIGHT", 1.5)),
        "low_rul_weight": float(TRAINING_POLICY.get("LOW_RUL_WEIGHT", 3.0)),
        "critical_over_weight": float(TRAINING_POLICY.get("CRITICAL_ASYMMETRIC_OVER_WEIGHT", 4.0)),
        "critical_under_weight": float(TRAINING_POLICY.get("CRITICAL_ASYMMETRIC_UNDER_WEIGHT", 1.0)),
        "recon_weight": float(bundle_data.get("model_hyperparameters", {}).get("RECON_WEIGHT", 0.1)),
        "fine_tune_lr": 5e-4,
        "stage2_lr": float(TRANSFER_POLICY.get("stage2_lr", 1e-4)),
        "stage2_trigger_patience": int(TRANSFER_POLICY.get("stage2_trigger_patience", 3)),
        "max_epochs": int(TRAINING_POLICY.get("MAX_EPOCHS", 32)),
        "early_stop_patience": int(TRAINING_POLICY.get("EARLY_STOP_PATIENCE", 6)),
        "min_improvement": float(TRAINING_POLICY.get("EARLY_STOP_MIN_DELTA", 0.1)),
        "weight_decay": 1e-4,
        "grad_clip": 1.0,
    }


def _calculate_metric_improvement(
    before_metrics: Dict[str, float],
    after_metrics: Dict[str, float],
) -> Dict[str, float]:
    return {
        "rmse_delta": round(after_metrics["rmse"] - before_metrics["rmse"], 4),
        "mae_delta": round(after_metrics["mae"] - before_metrics["mae"], 4),
        "accuracy_within_20_delta": round(
            after_metrics["accuracy_within_20"] - before_metrics["accuracy_within_20"], 4
        ),
    }


def _save_machine_overlay(
    machine_id: str,
    tuned_models: List[nn.Module],
    metadata: Dict[str, Any],
    csv_bytes: bytes,
) -> str:
    machine_dir = _machine_overlay_dir(machine_id)
    machine_dir.mkdir(parents=True, exist_ok=True)

    artifact_id = metadata["artifact_id"]
    overlay_payload = {
        "artifact_id": artifact_id,
        "machine_id": machine_id,
        "created_utc": metadata["trained_at"],
        "base_bundle_created_utc": bundle_data.get("created_utc"),
        "members": [
            {
                "index": index,
                "state_dict": {key: value.detach().cpu() for key, value in model.state_dict().items()},
            }
            for index, model in enumerate(tuned_models)
        ],
    }

    torch.save(overlay_payload, _machine_overlay_path(machine_id))
    with _machine_metadata_path(machine_id).open("w", encoding="utf-8") as metadata_file:
        json.dump(metadata, metadata_file, indent=2)
    _machine_upload_path(machine_id).write_bytes(csv_bytes)
    _invalidate_machine_overlay_cache(machine_id)
    overlay_metadata_cache[machine_id] = metadata
    return artifact_id


def fine_tune_machine_from_dataframe(
    machine_id: str,
    raw_df: pd.DataFrame,
    csv_bytes: bytes,
) -> Dict[str, Any]:
    config = _build_fine_tune_config()
    bundle = prepare_fine_tune_bundle(raw_df=raw_df, config=config, preprocess_fn=_apply_regime_scaling)
    coverage = bundle["coverage"]

    if coverage["coverage_status"] == "reject":
        raise HTTPException(
            400,
            (
                f"Uploaded CSV is missing too many registered sensors "
                f"({coverage['missing_sensor_ratio']:.2%} > {coverage['reject_threshold']:.0%})."
            ),
        )

    test_loader = bundle["test_loader"]
    before_pred, before_true, before_metrics = evaluate_model_ensemble(
        ensemble_models, test_loader, device, RUL_CAP
    )

    tuned_models: List[nn.Module] = []
    training_histories: List[List[Dict[str, Any]]] = []
    for index, base_model in enumerate(ensemble_models):
        tuned_model, history = fine_tune_model(
            base_model=base_model,
            train_loader=bundle["train_loader"],
            val_loader=bundle["val_loader"],
            device=device,
            rul_cap=RUL_CAP,
            config=config,
            model_name=f"{machine_id}-member-{index}",
        )
        tuned_models.append(tuned_model)
        training_histories.append(history)

    after_pred, after_true, after_metrics = evaluate_model_ensemble(
        tuned_models, test_loader, device, RUL_CAP
    )
    accepted = after_metrics["rmse"] <= before_metrics["rmse"]
    trained_at = _utc_now_iso()
    artifact_id = f"{_sanitize_machine_id(machine_id)}-{trained_at.replace(':', '').replace('.', '')}"

    response = {
        "machine_id": machine_id,
        "accepted": accepted,
        "has_custom_model": accepted,
        "before_metrics": before_metrics,
        "after_metrics": after_metrics,
        "improvement": _calculate_metric_improvement(before_metrics, after_metrics),
        "coverage": coverage,
        "artifact_id": artifact_id if accepted else None,
        "trained_at": trained_at,
        "tuning_strategy": {
            "base_bundle_modified": False,
            "adapter_head_parameter_share_pct": ADAPTER_HEAD_PARAMETER_SHARE_PCT,
            "stage1_blocks": ["adapter", "health_embedding", "rul_head"],
            "stage2_blocks": ["temporal_attn", "conv3", "norm3", "transformer.layers[-1]"],
        },
        "evaluation_sample_count": int(len(before_true)),
        "train_history": training_histories,
        "baseline_preview": {
            "true_rul": [round(float(value), 3) for value in before_true[:10]],
            "before_pred": [round(float(value), 3) for value in before_pred[:10]],
            "after_pred": [round(float(value), 3) for value in after_pred[:10]],
        },
    }

    if accepted:
        metadata = {
            "machine_id": machine_id,
            "has_custom_model": True,
            "trained_at": trained_at,
            "artifact_id": artifact_id,
            "before_metrics": before_metrics,
            "after_metrics": after_metrics,
            "improvement": response["improvement"],
            "coverage": coverage,
            "tuning_strategy": response["tuning_strategy"],
        }
        _save_machine_overlay(machine_id, tuned_models, metadata, csv_bytes)

    return response


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
    models = _resolve_models_for_engine(request.engine_id)

    # ── 4. Ensemble inference ──────────────────────────────────────────
    ensemble_preds, ensemble_vars, ensemble_anoms = [], [], []
    ensemble_attn = []

    with torch.no_grad():
        for model in models:
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
    explain_model = models[0]

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
    models = _resolve_models_for_engine(request.engine_id)

    ensemble_anomalies = np.zeros(num_flights)
    ensemble_ruls      = np.zeros(num_flights)

    with torch.no_grad():
        for model in models:
            pred_rul, _, recon, _ = model(
                batch_ids, batch_vals, batch_mask, batch_gap, batch_qual, batch_ops
            )
            ensemble_ruls += np.clip(pred_rul.cpu().numpy().flatten(), 0, RUL_CAP)
            recon_err = ((recon - batch_vals) ** 2 * batch_mask).mean(dim=(1, 2)).cpu().numpy()
            ensemble_anomalies += recon_err

    ensemble_ruls      /= len(models)
    ensemble_anomalies /= len(models)

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


@app.get("/machines/{machine_id}/fine-tune-status")
async def get_fine_tune_status(machine_id: str):
    metadata = _load_machine_overlay_metadata(machine_id)
    if not metadata:
        return {
            "machine_id": machine_id,
            "has_custom_model": False,
            "trained_at": None,
            "before_metrics": None,
            "after_metrics": None,
            "artifact_id": None,
        }

    return {
        "machine_id": machine_id,
        "has_custom_model": bool(metadata.get("has_custom_model", False)),
        "trained_at": metadata.get("trained_at"),
        "before_metrics": metadata.get("before_metrics"),
        "after_metrics": metadata.get("after_metrics"),
        "artifact_id": metadata.get("artifact_id"),
        "coverage": metadata.get("coverage"),
        "tuning_strategy": metadata.get("tuning_strategy"),
    }


@app.post("/machines/{machine_id}/fine-tune")
async def fine_tune_machine(machine_id: str, file: UploadFile = File(...)):
    filename = file.filename or ""
    if not filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only CSV uploads are supported for fine-tuning.")

    csv_bytes = await file.read()
    if not csv_bytes.strip():
        raise HTTPException(400, "Uploaded CSV file is empty.")

    try:
        raw_df = pd.read_csv(io.BytesIO(csv_bytes))
    except Exception as exc:  # pragma: no cover - parser errors are runtime dependent
        raise HTTPException(400, f"Failed to parse CSV: {exc}") from exc

    try:
        return fine_tune_machine_from_dataframe(machine_id=machine_id, raw_df=raw_df, csv_bytes=csv_bytes)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

# ==========================================
# 9. ENTRYPOINT
# ==========================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
