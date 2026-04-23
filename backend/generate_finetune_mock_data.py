import json
from pathlib import Path

import numpy as np
import pandas as pd

from main import fine_tune_machine_from_dataframe, load_deploy_bundle


CURRENT_DIR = Path(__file__).resolve().parent
MOCK_DIR = CURRENT_DIR / "mock_data"

REGISTERED_SENSORS = [
    "sensor_2",
    "sensor_3",
    "sensor_4",
    "sensor_7",
    "sensor_8",
    "sensor_9",
    "sensor_11",
    "sensor_12",
    "sensor_13",
    "sensor_14",
    "sensor_15",
    "sensor_17",
    "sensor_20",
    "sensor_21",
]

BASE_ROW = {
    "setting_1": 10.0046,
    "setting_2": 0.2500,
    "setting_3": 100.0,
    "sensor_2": 604.13,
    "sensor_3": 1499.45,
    "sensor_4": 1309.95,
    "sensor_7": 394.88,
    "sensor_8": 2318.87,
    "sensor_9": 8770.20,
    "sensor_11": 45.40,
    "sensor_12": 371.71,
    "sensor_13": 2388.13,
    "sensor_14": 8128.60,
    "sensor_15": 8.6216,
    "sensor_17": 369.0,
    "sensor_20": 28.58,
    "sensor_21": 17.1735,
}

SENSOR_DRIFT_WEIGHTS = {
    "sensor_2": ("up", 1.65),
    "sensor_3": ("up", 1.45),
    "sensor_4": ("up", 1.25),
    "sensor_7": ("down", 1.60),
    "sensor_8": ("up", 1.15),
    "sensor_9": ("up", 0.85),
    "sensor_11": ("up", 1.80),
    "sensor_12": ("down", 1.05),
    "sensor_13": ("up", 1.35),
    "sensor_14": ("up", 1.10),
    "sensor_15": ("up", 1.55),
    "sensor_17": ("up", 1.05),
    "sensor_20": ("down", 1.45),
    "sensor_21": ("down", 1.20),
}

MOCK_SEVERITY_SCALE = 0.16

ENGINE_PROFILES = [
    {
        "cycles": 18,
        "base_shift": 0.020,
        "drift_scale": 0.056,
        "shock_start": 0.60,
        "shock_strength": 0.014,
        "op_offsets": (1.48, 0.041, -4.7),
        "oscillation_amp": 0.007,
        "oscillation_freq": 4.0,
    },
    {
        "cycles": 19,
        "base_shift": 0.022,
        "drift_scale": 0.060,
        "shock_start": 0.56,
        "shock_strength": 0.015,
        "op_offsets": (1.55, 0.045, -5.1),
        "oscillation_amp": 0.008,
        "oscillation_freq": 4.7,
    },
    {
        "cycles": 20,
        "base_shift": 0.023,
        "drift_scale": 0.063,
        "shock_start": 0.62,
        "shock_strength": 0.016,
        "op_offsets": (1.62, 0.047, -5.5),
        "oscillation_amp": 0.008,
        "oscillation_freq": 5.2,
    },
    {
        "cycles": 21,
        "base_shift": 0.024,
        "drift_scale": 0.066,
        "shock_start": 0.58,
        "shock_strength": 0.017,
        "op_offsets": (1.70, 0.050, -5.8),
        "oscillation_amp": 0.009,
        "oscillation_freq": 4.4,
    },
    {
        "cycles": 22,
        "base_shift": 0.025,
        "drift_scale": 0.070,
        "shock_start": 0.64,
        "shock_strength": 0.018,
        "op_offsets": (1.76, 0.052, -6.1),
        "oscillation_amp": 0.009,
        "oscillation_freq": 5.5,
    },
    {
        "cycles": 22,
        "base_shift": 0.021,
        "drift_scale": 0.058,
        "shock_start": 0.57,
        "shock_strength": 0.015,
        "op_offsets": (1.52, 0.043, -4.9),
        "oscillation_amp": 0.007,
        "oscillation_freq": 3.8,
    },
    {
        "cycles": 23,
        "base_shift": 0.026,
        "drift_scale": 0.073,
        "shock_start": 0.61,
        "shock_strength": 0.019,
        "op_offsets": (1.84, 0.054, -6.4),
        "oscillation_amp": 0.010,
        "oscillation_freq": 5.9,
    },
    {
        "cycles": 24,
        "base_shift": 0.027,
        "drift_scale": 0.075,
        "shock_start": 0.59,
        "shock_strength": 0.020,
        "op_offsets": (1.91, 0.056, -6.8),
        "oscillation_amp": 0.010,
        "oscillation_freq": 4.6,
    },
    {
        "cycles": 25,
        "base_shift": 0.028,
        "drift_scale": 0.078,
        "shock_start": 0.65,
        "shock_strength": 0.021,
        "op_offsets": (2.00, 0.058, -7.2),
        "oscillation_amp": 0.011,
        "oscillation_freq": 6.1,
    },
    {
        "cycles": 26,
        "base_shift": 0.024,
        "drift_scale": 0.068,
        "shock_start": 0.58,
        "shock_strength": 0.017,
        "op_offsets": (1.68, 0.049, -5.7),
        "oscillation_amp": 0.008,
        "oscillation_freq": 4.1,
    },
    {
        "cycles": 28,
        "base_shift": 0.030,
        "drift_scale": 0.082,
        "shock_start": 0.63,
        "shock_strength": 0.022,
        "op_offsets": (2.08, 0.061, -7.5),
        "oscillation_amp": 0.011,
        "oscillation_freq": 6.4,
    },
]


def build_engine_run(engine_id: str, profile: dict, seed: int) -> list[dict]:
    rng = np.random.default_rng(seed)
    rows: list[dict] = []
    total_cycles = profile["cycles"]

    for cycle in range(1, total_cycles + 1):
        row = BASE_ROW.copy()
        progress = cycle / max(total_cycles - 1, 1)
        curve = progress ** 1.85
        shock = profile["shock_strength"] * MOCK_SEVERITY_SCALE if progress >= profile["shock_start"] else 0.0
        oscillation = np.sin(progress * np.pi * profile["oscillation_freq"]) * profile["oscillation_amp"]
        base_shift = profile["base_shift"]
        severity = (base_shift + curve * profile["drift_scale"]) * MOCK_SEVERITY_SCALE + shock

        for sensor_name in REGISTERED_SENSORS:
            direction, weight = SENSOR_DRIFT_WEIGHTS[sensor_name]
            sensor_noise = rng.normal(0, 0.0016)
            sensor_wave = oscillation * weight
            sensor_shift = severity * weight + sensor_wave + sensor_noise
            if direction == "up":
                row[sensor_name] = BASE_ROW[sensor_name] * (1.0 + sensor_shift)
            else:
                row[sensor_name] = BASE_ROW[sensor_name] * max(0.2, 1.0 - sensor_shift)

        op1_offset, op2_offset, op3_offset = profile["op_offsets"]
        row["setting_1"] = BASE_ROW["setting_1"] + op1_offset + curve * 0.35 + rng.normal(0, 0.03)
        row["setting_2"] = BASE_ROW["setting_2"] + op2_offset + curve * 0.008 + rng.normal(0, 0.003)
        row["setting_3"] = BASE_ROW["setting_3"] + op3_offset + curve * 0.55 + rng.normal(0, 0.12)
        row["engine_id"] = engine_id
        row["cycle"] = cycle
        row["rul"] = max(total_cycles - cycle, 0)
        rows.append(row)

    return rows


def build_mock_dataframe(machine_id: str) -> pd.DataFrame:
    rows: list[dict] = []
    for idx, profile in enumerate(ENGINE_PROFILES):
        engine_id = f"{machine_id}-engine-{idx + 1}"
        rows.extend(build_engine_run(engine_id, profile, seed=42 + idx))

    return pd.DataFrame(rows)


def main() -> None:
    machine_id = "machine-1"
    load_deploy_bundle()
    MOCK_DIR.mkdir(parents=True, exist_ok=True)

    dataframe = build_mock_dataframe(machine_id)
    csv_path = MOCK_DIR / f"fine_tune_{machine_id}.csv"
    dataframe.to_csv(csv_path, index=False)
    csv_bytes = csv_path.read_bytes()

    result = fine_tune_machine_from_dataframe(machine_id=machine_id, raw_df=dataframe, csv_bytes=csv_bytes)
    report_path = MOCK_DIR / f"fine_tune_report_{machine_id}.json"
    report_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    print(f"Mock fine-tune CSV saved to: {csv_path}")
    print(f"Fine-tune report saved to: {report_path}")
    print("")
    print(f"Rows generated: {len(dataframe)}")
    print(f"Columns generated: {len(dataframe.columns)}")
    print(f"Before RMSE: {result['before_metrics']['rmse']:.4f}")
    print(f"After RMSE: {result['after_metrics']['rmse']:.4f}")
    print(f"Before MAE: {result['before_metrics']['mae']:.4f}")
    print(f"After MAE: {result['after_metrics']['mae']:.4f}")
    print(f"Before accuracy_within_20: {result['before_metrics']['accuracy_within_20']:.2f}%")
    print(f"After accuracy_within_20: {result['after_metrics']['accuracy_within_20']:.2f}%")
    print(f"Accepted overlay: {result['accepted']}")


if __name__ == "__main__":
    main()
