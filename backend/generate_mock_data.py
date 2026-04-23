import os
import sys
import json
import asyncio
import numpy as np

# Change CWD securely to the backend folder
current_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(current_dir)
sys.path.append(current_dir)

# Import the main logic required to hit the model internally
from main import load_deploy_bundle, InferenceRequest, predict_rul

# The deploy_bundle uses 14 registered sensors (not all 21).
# We include all 21 in the payload for realism; the API only reads the 14 it needs.
# Operating-settings use the old API names (op_setting_1/2/3) since the API remaps them.

base_flight = {
    "op_setting_1": 10.0046, "op_setting_2": 0.2500, "op_setting_3": 100.0,
    "sensor_1": 489.05, "sensor_2": 604.13, "sensor_3": 1499.45,
    "sensor_4": 1309.95, "sensor_5": 10.52, "sensor_6": 15.49,
    "sensor_7": 394.88, "sensor_8": 2318.87, "sensor_9": 8770.20,
    "sensor_10": 1.26, "sensor_11": 45.40, "sensor_12": 371.71,
    "sensor_13": 2388.13, "sensor_14": 8128.60, "sensor_15": 8.6216,
    "sensor_16": 0.03, "sensor_17": 369.0, "sensor_18": 2323.0,
    "sensor_19": 100.0, "sensor_20": 28.58, "sensor_21": 17.1735
}

def build_degraded_history(factor):
    """
    Simulates REALISTIC degradation over 60 flight cycles.
    The new model uses SEQ_LEN=60, so we generate 60 cycles
    to fill the full attention window.
    """
    history = []

    # Add slight random noise to prevent 0.0 standard deviations
    np.random.seed(42)

    for i in range(60):
        modified = base_flight.copy()

        # The slope increases as we approach the 60th frame
        time_progression = (i / 59.0)
        severity_slope = time_progression * factor * 0.001

        # Increasing trends for typical degradation in CMAPSS features
        for s in [2, 3, 4, 8, 11, 13, 15, 17]:
            noise = np.random.normal(0, 0.0001)
            modified[f'sensor_{s}'] *= (1.0 + severity_slope + noise)

        # Decreasing trends
        for s in [7, 12, 20, 21]:
            noise = np.random.normal(0, 0.0001)
            modified[f'sensor_{s}'] *= (1.0 - severity_slope + noise)

        history.append(modified)

    return history

async def seek_rul_target(target_rul):
    print(f"Seeking payload that evaluates to RUL ~ {target_rul}...")
    best_history = None
    best_diff = float('inf')
    best_rul = None

    # Expanded grid search to find the perfect micro-degradation slope
    for factor in np.linspace(0.0, 50.0, 500):
        history = build_degraded_history(factor)

        # Evaluate natively using the API's pure logic
        req = InferenceRequest(engine_id="MockGeneration", flight_history=history)
        resp = await predict_rul(req)

        diff = abs(resp.predicted_rul - target_rul)

        if diff < best_diff:
            best_diff = diff
            best_history = history
            best_rul = resp.predicted_rul

        # Target locked
        if diff < 1.0:
            break

    print(f" -> Optimal Found: Evaluates to RUL={best_rul:.2f} (Target: {target_rul})")
    return best_history

async def build_mocks():
    print("Initializing Deploy Bundle...")
    load_deploy_bundle()

    # Define outputs
    mock_dir = os.path.join(current_dir, "mock_data")
    if not os.path.exists(mock_dir):
        os.makedirs(mock_dir)

    # === CHANGED TARGET ARRAY HERE ===
    for target in [100, 40, 10]:
        flight_history = await seek_rul_target(target)

        payloadJSON = {
            "engine_id": f"Engine-Mock-RUL-{target}",
            "flight_history": flight_history
        }

        out_path = os.path.join(mock_dir, f"mock_payload_rul_{target}.json")
        with open(out_path, "w") as f:
            json.dump(payloadJSON, f, indent=2)

    print(f"\nSuccessfully generated 3 mock datasets localized in {mock_dir}")

if __name__ == "__main__":
    asyncio.run(build_mocks())