import copy
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Tuple

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.metrics import mean_absolute_error, mean_squared_error
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler


ACCURACY_TOLERANCE = 20.0


def _coerce_numeric_column(series: pd.Series, column_name: str, required: bool) -> pd.Series:
    original = series.astype(str).str.strip()
    numeric = pd.to_numeric(series, errors="coerce")
    invalid_mask = numeric.isna() & (original != "")
    if required:
        invalid_mask = numeric.isna()

    if invalid_mask.any():
        raise ValueError(f"Column '{column_name}' contains malformed numeric values.")

    return numeric


def align_uploaded_training_dataframe(
    raw_df: pd.DataFrame,
    registry_sensor_order: List[str],
    op_cols: List[str],
    warn_threshold: float,
    reject_threshold: float,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    df = raw_df.copy()
    df = df.dropna(how="all")
    if df.empty:
        raise ValueError("CSV file is empty.")

    df.columns = [str(col).strip() for col in df.columns]

    required_columns = ["engine_id", "cycle", "rul"]
    missing_required = [col for col in required_columns if col not in df.columns]
    if missing_required:
        raise ValueError(f"Missing required column(s): {', '.join(missing_required)}.")

    rename_map = {}
    if "op_setting_1" in df.columns and "setting_1" not in df.columns:
        rename_map["op_setting_1"] = "setting_1"
    if "op_setting_2" in df.columns and "setting_2" not in df.columns:
        rename_map["op_setting_2"] = "setting_2"
    if "op_setting_3" in df.columns and "setting_3" not in df.columns:
        rename_map["op_setting_3"] = "setting_3"
    if rename_map:
        df = df.rename(columns=rename_map)

    aligned = pd.DataFrame()
    aligned["engine_id"] = df["engine_id"].astype(str).str.strip()
    if (aligned["engine_id"] == "").any():
        raise ValueError("Column 'engine_id' cannot contain empty values.")

    aligned["cycle"] = _coerce_numeric_column(df["cycle"], "cycle", required=True).astype(np.int64)
    aligned["rul"] = _coerce_numeric_column(df["rul"], "rul", required=True).astype(np.float32)

    for op_col in op_cols:
        if op_col in df.columns:
            values = _coerce_numeric_column(df[op_col], op_col, required=False)
            aligned[op_col] = values.fillna(0.0).astype(np.float32)
        else:
            aligned[op_col] = np.float32(0.0)

    present_registered_sensors: List[str] = []
    missing_registered_sensors: List[str] = []
    unknown_sensor_columns = sorted(
        col for col in df.columns if col.startswith("sensor_") and col not in registry_sensor_order
    )

    for sensor_name in registry_sensor_order:
        if sensor_name in df.columns:
            sensor_values = _coerce_numeric_column(df[sensor_name], sensor_name, required=False)
            observed_mask = sensor_values.notna()
            if observed_mask.any():
                present_registered_sensors.append(sensor_name)
            else:
                missing_registered_sensors.append(sensor_name)
            aligned[sensor_name] = sensor_values.fillna(0.0).astype(np.float32)
            aligned[f"{sensor_name}_mask"] = observed_mask.astype(np.float32)
            aligned[f"{sensor_name}_quality"] = observed_mask.astype(np.int64)
        else:
            missing_registered_sensors.append(sensor_name)
            aligned[sensor_name] = np.float32(0.0)
            aligned[f"{sensor_name}_mask"] = np.float32(0.0)
            aligned[f"{sensor_name}_quality"] = np.int64(0)

    aligned = aligned.sort_values(["engine_id", "cycle"]).reset_index(drop=True)

    unique_engines = aligned["engine_id"].nunique()
    if unique_engines < 3:
        raise ValueError("Fine-tuning requires at least 3 distinct engine_id groups.")

    missing_ratio = len(missing_registered_sensors) / max(1, len(registry_sensor_order))
    if missing_ratio > reject_threshold:
        coverage_status = "reject"
    elif missing_ratio > warn_threshold:
        coverage_status = "warn"
    else:
        coverage_status = "ok"

    coverage = {
        "coverage_status": coverage_status,
        "warn_threshold": warn_threshold,
        "reject_threshold": reject_threshold,
        "registered_sensor_count": len(registry_sensor_order),
        "present_sensor_count": len(present_registered_sensors),
        "missing_sensor_count": len(missing_registered_sensors),
        "missing_sensor_ratio": float(missing_ratio),
        "present_sensors": present_registered_sensors,
        "missing_sensors": missing_registered_sensors,
        "unknown_sensor_columns": unknown_sensor_columns,
        "engine_group_count": int(unique_engines),
        "row_count": int(len(aligned)),
    }

    return aligned, coverage


def split_target_dataframe(
    aligned_df: pd.DataFrame,
    test_ratio: float = 0.25,
    val_ratio: float = 0.20,
    random_seed: int = 42,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    engine_ids = aligned_df["engine_id"].drop_duplicates().tolist()
    if len(engine_ids) < 3:
        raise ValueError("Fine-tuning requires at least 3 distinct engine_id groups.")

    rng = np.random.default_rng(random_seed)
    rng.shuffle(engine_ids)

    n_total = len(engine_ids)
    n_test = max(1, int(round(n_total * test_ratio)))
    n_val = max(1, int(round(n_total * val_ratio)))
    n_train = n_total - n_test - n_val

    while n_train < 1 and n_val > 1:
        n_val -= 1
        n_train = n_total - n_test - n_val
    while n_train < 1 and n_test > 1:
        n_test -= 1
        n_train = n_total - n_test - n_val

    if n_train < 1:
        raise ValueError("Unable to create train/validation/test splits from uploaded data.")

    train_ids = set(engine_ids[:n_train])
    val_ids = set(engine_ids[n_train : n_train + n_val])
    test_ids = set(engine_ids[n_train + n_val :])

    train_df = aligned_df[aligned_df["engine_id"].isin(train_ids)].copy()
    val_df = aligned_df[aligned_df["engine_id"].isin(val_ids)].copy()
    test_df = aligned_df[aligned_df["engine_id"].isin(test_ids)].copy()

    return train_df, val_df, test_df


def compute_time_gaps_from_mask(values: np.ndarray, masks: np.ndarray) -> np.ndarray:
    masks = np.asarray(masks, dtype=np.float32)
    gaps = np.zeros_like(np.asarray(values, dtype=np.float32), dtype=np.float32)
    _, sensor_count = masks.shape
    last_seen = np.full(sensor_count, -1, dtype=np.int32)

    for time_index in range(masks.shape[0]):
        seen = masks[time_index] > 0
        valid_last = last_seen >= 0
        gaps[time_index, valid_last] = (time_index - last_seen[valid_last]).astype(np.float32)
        last_seen[seen] = time_index

    return gaps


def build_engine_token_payload(
    aligned_df: pd.DataFrame,
    registry_sensor_order: List[str],
    op_cols: List[str],
) -> Dict[str, Dict[str, np.ndarray]]:
    engine_data: Dict[str, Dict[str, np.ndarray]] = {}

    for engine_id, group in aligned_df.groupby("engine_id", sort=False):
        group = group.sort_values("cycle")
        values = group[registry_sensor_order].values.astype(np.float32)
        masks = group[[f"{sensor}_mask" for sensor in registry_sensor_order]].values.astype(np.float32)
        quality = group[[f"{sensor}_quality" for sensor in registry_sensor_order]].values.astype(np.int64)
        operating_settings = group[op_cols].values.astype(np.float32)
        rul = group["rul"].values.astype(np.float32)
        gaps = compute_time_gaps_from_mask(values, masks)

        engine_data[str(engine_id)] = {
            "values": values,
            "mask": masks,
            "quality": quality,
            "gaps": gaps,
            "rul": rul,
            "operating_settings": operating_settings,
        }

    return engine_data


@dataclass
class FineTuneDatasetConfig:
    seq_len: int
    registry_sensor_order: List[str]
    registry_sensor_ids: Dict[str, int]
    op_cols: List[str]
    stride_high_rul: int
    stride_mid_rul: int
    stride_low_rul: int
    critical_rul_cutoff: int
    very_low_rul_threshold: int
    weight_high_rul: float
    weight_mid_rul: float
    weight_low_rul: float


class PrecomputedTokenWindowDataset(Dataset):
    def __init__(
        self,
        engine_data: Dict[str, Dict[str, np.ndarray]],
        config: FineTuneDatasetConfig,
        final_window_only: bool,
    ) -> None:
        self.engine_ids: List[str] = []
        self.sample_weights: List[float] = []

        sensor_ids_row = np.array(
            [config.registry_sensor_ids[sensor_name] for sensor_name in config.registry_sensor_order],
            dtype=np.int64,
        )

        sensor_ids: List[np.ndarray] = []
        sensor_values: List[np.ndarray] = []
        sensor_masks: List[np.ndarray] = []
        sensor_gaps: List[np.ndarray] = []
        sensor_quality: List[np.ndarray] = []
        operating_settings: List[np.ndarray] = []
        targets: List[np.float32] = []

        for engine_id, payload in engine_data.items():
            values = payload["values"]
            masks = payload["mask"]
            quality = payload["quality"]
            gaps = payload["gaps"]
            rul = payload["rul"]
            ops = payload["operating_settings"]
            n_rows = len(rul)
            if n_rows == 0:
                continue

            if final_window_only:
                candidate_indices = [n_rows - 1]
            else:
                candidate_indices = []
                for end_idx in range(n_rows):
                    target_rul = float(rul[end_idx])
                    if target_rul < config.very_low_rul_threshold:
                        stride = config.stride_low_rul
                    elif target_rul < config.critical_rul_cutoff:
                        stride = config.stride_mid_rul
                    else:
                        stride = config.stride_high_rul
                    if end_idx % max(1, stride) == 0:
                        candidate_indices.append(end_idx)
                if (n_rows - 1) not in candidate_indices:
                    candidate_indices.append(n_rows - 1)

            for end_idx in sorted(set(candidate_indices)):
                start_idx = max(0, end_idx - config.seq_len + 1)
                window_values = values[start_idx : end_idx + 1]
                window_masks = masks[start_idx : end_idx + 1]
                window_quality = quality[start_idx : end_idx + 1]
                window_gaps = gaps[start_idx : end_idx + 1]
                window_ops = ops[start_idx : end_idx + 1]
                window_len, sensor_count = window_values.shape

                padded_values = np.zeros((config.seq_len, sensor_count), dtype=np.float32)
                padded_masks = np.zeros((config.seq_len, sensor_count), dtype=np.float32)
                padded_quality = np.zeros((config.seq_len, sensor_count), dtype=np.int64)
                padded_gaps = np.zeros((config.seq_len, sensor_count), dtype=np.float32)
                padded_ops = np.zeros((config.seq_len, len(config.op_cols)), dtype=np.float32)

                padded_values[-window_len:] = window_values
                padded_masks[-window_len:] = window_masks
                padded_quality[-window_len:] = window_quality
                padded_gaps[-window_len:] = window_gaps
                padded_ops[-window_len:] = window_ops

                target_rul = float(rul[end_idx])
                if target_rul < config.very_low_rul_threshold:
                    sample_weight = config.weight_low_rul
                elif target_rul < config.critical_rul_cutoff:
                    sample_weight = config.weight_mid_rul
                else:
                    sample_weight = config.weight_high_rul

                sensor_ids.append(np.tile(sensor_ids_row[None, :], (config.seq_len, 1)))
                sensor_values.append(padded_values)
                sensor_masks.append(padded_masks)
                sensor_quality.append(padded_quality)
                sensor_gaps.append(padded_gaps)
                operating_settings.append(padded_ops)
                targets.append(np.float32(target_rul))
                self.engine_ids.append(engine_id)
                self.sample_weights.append(float(sample_weight))

        if not targets:
            raise ValueError("Unable to build training windows from uploaded data.")

        self.sensor_ids = torch.tensor(np.stack(sensor_ids), dtype=torch.int64)
        self.sensor_values = torch.tensor(np.stack(sensor_values), dtype=torch.float32)
        self.sensor_masks = torch.tensor(np.stack(sensor_masks), dtype=torch.float32)
        self.sensor_quality = torch.tensor(np.stack(sensor_quality), dtype=torch.int64)
        self.sensor_gaps = torch.tensor(np.stack(sensor_gaps), dtype=torch.float32)
        self.operating_settings = torch.tensor(np.stack(operating_settings), dtype=torch.float32)
        self.targets = torch.tensor(np.asarray(targets, dtype=np.float32), dtype=torch.float32)

    def __len__(self) -> int:
        return len(self.targets)

    def __getitem__(self, index: int) -> Dict[str, Any]:
        return {
            "sensor_ids": self.sensor_ids[index],
            "sensor_values": self.sensor_values[index],
            "sensor_mask": self.sensor_masks[index],
            "sensor_quality": self.sensor_quality[index],
            "sensor_time_gap": self.sensor_gaps[index],
            "operating_settings": self.operating_settings[index],
            "target_rul": self.targets[index],
            "engine_id": self.engine_ids[index],
        }


def collate_batch(batch: List[Dict[str, Any]]) -> Dict[str, Any]:
    keys = [
        "sensor_ids",
        "sensor_values",
        "sensor_mask",
        "sensor_quality",
        "sensor_time_gap",
        "operating_settings",
        "target_rul",
    ]
    output: Dict[str, Any] = {}
    for key in keys:
        output[key] = torch.stack([item[key] for item in batch], dim=0)
    output["engine_id"] = [item["engine_id"] for item in batch]
    return output


def build_loader(
    engine_data: Dict[str, Dict[str, np.ndarray]],
    dataset_config: FineTuneDatasetConfig,
    batch_size: int,
    final_window_only: bool,
) -> DataLoader:
    dataset = PrecomputedTokenWindowDataset(
        engine_data=engine_data,
        config=dataset_config,
        final_window_only=final_window_only,
    )

    loader_kwargs = {
        "batch_size": batch_size,
        "num_workers": 0,
        "pin_memory": False,
        "collate_fn": collate_batch,
    }

    if final_window_only:
        return DataLoader(dataset, shuffle=False, **loader_kwargs)

    sampler = WeightedRandomSampler(
        weights=torch.DoubleTensor(dataset.sample_weights),
        num_samples=len(dataset.sample_weights),
        replacement=True,
    )
    return DataLoader(dataset, sampler=sampler, **loader_kwargs)


def move_batch_to_device(batch: Dict[str, Any], device: torch.device) -> Dict[str, Any]:
    output: Dict[str, Any] = {}
    for key, value in batch.items():
        if torch.is_tensor(value):
            output[key] = value.to(device)
        else:
            output[key] = value
    return output


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    return {
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "accuracy_within_20": float(np.mean(np.abs(y_pred - y_true) <= ACCURACY_TOLERANCE) * 100.0),
    }


@torch.no_grad()
def evaluate_model(
    model: nn.Module,
    loader: DataLoader,
    device: torch.device,
    rul_cap: float,
) -> Tuple[np.ndarray, np.ndarray, Dict[str, float]]:
    model.eval()
    preds: List[np.ndarray] = []
    truth: List[np.ndarray] = []

    for batch in loader:
        batch = move_batch_to_device(batch, device)
        pred_rul, _, _, _ = model(
            batch["sensor_ids"],
            batch["sensor_values"],
            batch["sensor_mask"],
            batch["sensor_time_gap"],
            batch["sensor_quality"],
            batch["operating_settings"],
        )
        preds.append(pred_rul.detach().cpu().numpy())
        truth.append(batch["target_rul"].detach().cpu().numpy())

    y_pred = np.clip(np.concatenate(preds), 0, rul_cap)
    y_true = np.concatenate(truth)
    return y_pred, y_true, compute_metrics(y_true, y_pred)


@torch.no_grad()
def evaluate_model_ensemble(
    models: List[nn.Module],
    loader: DataLoader,
    device: torch.device,
    rul_cap: float,
) -> Tuple[np.ndarray, np.ndarray, Dict[str, float]]:
    ensemble_preds: List[np.ndarray] = []
    truth: List[np.ndarray] = []

    for batch in loader:
        batch = move_batch_to_device(batch, device)
        member_preds: List[np.ndarray] = []
        for model in models:
            model.eval()
            pred_rul, _, _, _ = model(
                batch["sensor_ids"],
                batch["sensor_values"],
                batch["sensor_mask"],
                batch["sensor_time_gap"],
                batch["sensor_quality"],
                batch["operating_settings"],
            )
            member_preds.append(pred_rul.detach().cpu().numpy())
        ensemble_preds.append(np.mean(np.stack(member_preds, axis=0), axis=0))
        truth.append(batch["target_rul"].detach().cpu().numpy())

    y_pred = np.clip(np.concatenate(ensemble_preds), 0, rul_cap)
    y_true = np.concatenate(truth)
    return y_pred, y_true, compute_metrics(y_true, y_pred)


@torch.no_grad()
def adapt_norm_layer_from_loader(model: nn.Module, loader: DataLoader, device: torch.device) -> None:
    count = None
    mean = None
    m2 = None

    for batch in loader:
        sensor_values = batch["sensor_values"].to(device)
        sensor_mask = batch["sensor_mask"].to(device)
        flat_values = sensor_values.reshape(-1, sensor_values.shape[-1])
        flat_mask = sensor_mask.reshape(-1, sensor_mask.shape[-1])

        for sensor_index in range(flat_values.shape[1]):
            valid = flat_mask[:, sensor_index] > 0
            if not torch.any(valid):
                continue

            observed = flat_values[valid, sensor_index]
            batch_count = observed.numel()
            batch_mean = observed.mean()
            batch_m2 = ((observed - batch_mean) ** 2).sum()

            if count is None:
                count = torch.zeros(flat_values.shape[1], device=device)
                mean = torch.zeros(flat_values.shape[1], device=device)
                m2 = torch.zeros(flat_values.shape[1], device=device)

            existing_count = count[sensor_index]
            incoming_count = torch.tensor(float(batch_count), device=device)
            delta = batch_mean - mean[sensor_index]
            total_count = existing_count + incoming_count
            mean[sensor_index] = mean[sensor_index] + delta * (incoming_count / total_count)
            m2[sensor_index] = (
                m2[sensor_index]
                + batch_m2
                + (delta ** 2) * existing_count * incoming_count / total_count
            )
            count[sensor_index] = total_count

    if count is None or mean is None or m2 is None:
        raise ValueError("Uploaded data did not contain any observed sensor values for normalization.")

    safe_count = count.clamp(min=1.0)
    std = torch.sqrt((m2 / safe_count).clamp(min=1e-6))
    model.norm_layer.running_mean.copy_(mean.detach().cpu())
    model.norm_layer.running_std.copy_(std.detach().cpu())


def freeze_base_except_adapter_and_head(model: nn.Module) -> None:
    for param in model.parameters():
        param.requires_grad = False

    for module in [model.adapter, model.health_embedding, model.rul_head]:
        for param in module.parameters():
            param.requires_grad = True


def unfreeze_stage2_for_domain_shift(model: nn.Module) -> None:
    freeze_base_except_adapter_and_head(model)

    for module in [model.temporal_attn, model.conv3, model.norm3]:
        for param in module.parameters():
            param.requires_grad = True

    if hasattr(model.transformer, "layers") and len(model.transformer.layers) > 0:
        for param in model.transformer.layers[-1].parameters():
            param.requires_grad = True


def reconstruction_loss(
    reconstruction: torch.Tensor,
    sensor_values: torch.Tensor,
    sensor_mask: torch.Tensor,
) -> torch.Tensor:
    squared_error = (reconstruction - sensor_values) ** 2
    masked_error = squared_error * sensor_mask
    denominator = sensor_mask.sum().clamp(min=1.0)
    return masked_error.sum() / denominator


def heteroscedastic_loss(
    pred_rul: torch.Tensor,
    true_rul: torch.Tensor,
    log_var: torch.Tensor,
    mid_rul_threshold: float,
    low_rul_threshold: float,
    mid_rul_weight: float,
    low_rul_weight: float,
) -> torch.Tensor:
    log_var = torch.clamp(log_var, -6, 6)
    precision = torch.exp(-log_var)
    error = pred_rul - true_rul
    abs_error = nn.functional.smooth_l1_loss(pred_rul, true_rul, reduction="none")

    weights = torch.ones_like(true_rul)
    weights = torch.where(true_rul < mid_rul_threshold, torch.full_like(weights, mid_rul_weight), weights)
    weights = torch.where(true_rul < low_rul_threshold, torch.full_like(weights, low_rul_weight), weights)

    nll_term = 0.5 * precision * weights * (error ** 2) + 0.5 * log_var
    robust_term = weights * abs_error
    return torch.mean(nll_term + 0.25 * robust_term)


def critical_asymmetric_penalty(
    pred_rul: torch.Tensor,
    true_rul: torch.Tensor,
    threshold: float,
    over_weight: float,
    under_weight: float,
) -> torch.Tensor:
    critical_mask = true_rul < threshold
    if critical_mask.sum() == 0:
        return pred_rul.new_tensor(0.0)

    error = pred_rul[critical_mask] - true_rul[critical_mask]
    weights = torch.where(
        error > 0,
        torch.full_like(error, over_weight),
        torch.full_like(error, under_weight),
    )
    return (weights * error.abs()).mean()


def total_training_loss(
    pred_rul: torch.Tensor,
    true_rul: torch.Tensor,
    log_var: torch.Tensor,
    reconstruction: torch.Tensor,
    sensor_values: torch.Tensor,
    sensor_mask: torch.Tensor,
    config: Dict[str, Any],
) -> torch.Tensor:
    rul_loss = heteroscedastic_loss(
        pred_rul=pred_rul,
        true_rul=true_rul,
        log_var=log_var,
        mid_rul_threshold=config["mid_rul_threshold"],
        low_rul_threshold=config["low_rul_threshold"],
        mid_rul_weight=config["mid_rul_weight"],
        low_rul_weight=config["low_rul_weight"],
    )
    recon_term = config["recon_weight"] * reconstruction_loss(
        reconstruction=reconstruction,
        sensor_values=sensor_values,
        sensor_mask=sensor_mask,
    )
    safety_term = critical_asymmetric_penalty(
        pred_rul=pred_rul,
        true_rul=true_rul,
        threshold=config["low_rul_threshold"],
        over_weight=config["critical_over_weight"],
        under_weight=config["critical_under_weight"],
    )
    return rul_loss + recon_term + safety_term


def fine_tune_model(
    base_model: nn.Module,
    train_loader: DataLoader,
    val_loader: DataLoader,
    device: torch.device,
    rul_cap: float,
    config: Dict[str, Any],
    model_name: str,
) -> Tuple[nn.Module, List[Dict[str, Any]]]:
    model_ft = copy.deepcopy(base_model).to(device)
    adapt_norm_layer_from_loader(model_ft, train_loader, device)
    freeze_base_except_adapter_and_head(model_ft)

    trainable_params = [param for param in model_ft.parameters() if param.requires_grad]
    optimizer = optim.AdamW(
        trainable_params,
        lr=config["fine_tune_lr"],
        weight_decay=config["weight_decay"],
    )

    history: List[Dict[str, Any]] = []
    best_state = None
    best_val_rmse = float("inf")
    patience_counter = 0
    stalled_epochs = 0
    stage2_enabled = False

    for epoch in range(1, config["max_epochs"] + 1):
        model_ft.train()
        running_loss = 0.0

        for batch in train_loader:
            batch = move_batch_to_device(batch, device)
            optimizer.zero_grad(set_to_none=True)

            pred_rul, log_var, reconstruction, _ = model_ft(
                batch["sensor_ids"],
                batch["sensor_values"],
                batch["sensor_mask"],
                batch["sensor_time_gap"],
                batch["sensor_quality"],
                batch["operating_settings"],
            )

            loss = total_training_loss(
                pred_rul=pred_rul,
                true_rul=batch["target_rul"],
                log_var=log_var,
                reconstruction=reconstruction,
                sensor_values=batch["sensor_values"],
                sensor_mask=batch["sensor_mask"],
                config=config,
            )
            loss.backward()
            torch.nn.utils.clip_grad_norm_(trainable_params, config["grad_clip"])
            optimizer.step()
            running_loss += float(loss.item())

        _, _, val_metrics = evaluate_model(model_ft, val_loader, device, rul_cap)
        val_rmse = val_metrics["rmse"]
        history.append(
            {
                "epoch": epoch,
                "train_loss": running_loss / max(1, len(train_loader)),
                "val_rmse": val_metrics["rmse"],
                "val_mae": val_metrics["mae"],
                "val_accuracy_within_20": val_metrics["accuracy_within_20"],
                "stage2_enabled": stage2_enabled,
                "model_name": model_name,
            }
        )

        if val_rmse + config["min_improvement"] < best_val_rmse:
            best_val_rmse = val_rmse
            best_state = {key: value.detach().cpu().clone() for key, value in model_ft.state_dict().items()}
            patience_counter = 0
            stalled_epochs = 0
        else:
            patience_counter += 1
            stalled_epochs += 1

        if (not stage2_enabled) and stalled_epochs >= config["stage2_trigger_patience"]:
            unfreeze_stage2_for_domain_shift(model_ft)
            trainable_params = [param for param in model_ft.parameters() if param.requires_grad]
            optimizer = optim.AdamW(
                trainable_params,
                lr=config["stage2_lr"],
                weight_decay=config["weight_decay"],
            )
            stage2_enabled = True
            stalled_epochs = 0

        if patience_counter >= config["early_stop_patience"]:
            break

    if best_state is not None:
        model_ft.load_state_dict(best_state, strict=True)

    model_ft.eval()
    return model_ft, history


def prepare_fine_tune_bundle(
    raw_df: pd.DataFrame,
    config: Dict[str, Any],
    preprocess_fn: Callable[[pd.DataFrame], pd.DataFrame],
) -> Dict[str, Any]:
    aligned_df, coverage = align_uploaded_training_dataframe(
        raw_df=raw_df,
        registry_sensor_order=config["registry_sensor_order"],
        op_cols=config["op_cols"],
        warn_threshold=config["coverage_warn_threshold"],
        reject_threshold=config["coverage_reject_threshold"],
    )

    if coverage["coverage_status"] == "reject":
        return {
            "coverage": coverage,
            "aligned_df": aligned_df,
        }

    train_df, val_df, test_df = split_target_dataframe(
        aligned_df=aligned_df,
        test_ratio=config["test_ratio"],
        val_ratio=config["val_ratio"],
        random_seed=config["random_seed"],
    )

    train_df = preprocess_fn(train_df.copy())
    val_df = preprocess_fn(val_df.copy())
    test_df = preprocess_fn(test_df.copy())

    dataset_config = FineTuneDatasetConfig(
        seq_len=config["seq_len"],
        registry_sensor_order=config["registry_sensor_order"],
        registry_sensor_ids=config["registry_sensor_ids"],
        op_cols=config["op_cols"],
        stride_high_rul=config["stride_high_rul"],
        stride_mid_rul=config["stride_mid_rul"],
        stride_low_rul=config["stride_low_rul"],
        critical_rul_cutoff=config["critical_rul_cutoff"],
        very_low_rul_threshold=config["very_low_rul_threshold"],
        weight_high_rul=config["weight_high_rul"],
        weight_mid_rul=config["weight_mid_rul"],
        weight_low_rul=config["weight_low_rul"],
    )

    train_engine_data = build_engine_token_payload(train_df, config["registry_sensor_order"], config["op_cols"])
    val_engine_data = build_engine_token_payload(val_df, config["registry_sensor_order"], config["op_cols"])
    test_engine_data = build_engine_token_payload(test_df, config["registry_sensor_order"], config["op_cols"])

    return {
        "coverage": coverage,
        "aligned_df": aligned_df,
        "train_loader": build_loader(
            engine_data=train_engine_data,
            dataset_config=dataset_config,
            batch_size=config["batch_size"],
            final_window_only=False,
        ),
        "val_loader": build_loader(
            engine_data=val_engine_data,
            dataset_config=dataset_config,
            batch_size=config["batch_size"],
            final_window_only=True,
        ),
        "test_loader": build_loader(
            engine_data=test_engine_data,
            dataset_config=dataset_config,
            batch_size=config["batch_size"],
            final_window_only=True,
        ),
    }
