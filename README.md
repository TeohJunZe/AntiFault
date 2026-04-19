# AntiFault Digital Twin Platform

AntiFault is an advanced Predictive Maintenance Platform and Digital Twin Dashboard designed to monitor industrial machinery. The system leverages real-time telemetry, 3D visualization, predictive analytics, and a fully conversational Voice AI Assistant named "Neo".

## What Our System Does

1. **Fleet Monitoring:** Provides a bird's eye view and detailed 3D models of factory floor machinery, tracking live metrics like temperature, vibration, load, and pressure.
2. **Predictive Analytics:** Calculates the Remaining Useful Life (RUL) of machines and their individual components to predict failures before they happen.
3. **Voice Assistant (Neo):** An intelligent, fully-integrated voice assistant that you can summon by saying "Hey Neo". 
   - Ask Neo for status updates, predictive analysis, and health reports.
   - Neo can interact directly with the UI, auto-routing you to relevant dashboard pages.
   - Schedule maintenance simply by talking to Neo (e.g., *"Hey Neo, help me to schedule maintenance of hydraulic press"*).

## Predictive Analysis Model

For details on the predictive analysis model that powers our Remaining Useful Life (RUL) prediction, please refer to the dedicated repository:
- **GitHub Repository:** [Predictive-Maintainance-RUL-Prediction-Model](https://github.com/yongjeen2409/Predictive-Maintainance-RUL-Prediction-Model.git)
- **Streamlit App Demo:** [View Model Result Here](https://predictive-maintainance-rul-prediction-model-sorite-gang.streamlit.app/)

### Machine-Specific Fine-Tuning

The backend now supports machine-specific fine-tuning overlays. Fine-tuning does not overwrite `backend/deploy_bundle.pt`; instead, accepted runs save a separate machine-scoped `.pt` overlay under `backend/machine_models/<machine_id>/`.

The current deployment bundle uses adapter-style transfer learning. Stage 1 primarily tunes the adapter and prediction head layers first, then only unfreezes a limited late-stage slice if validation stalls. This keeps the base fleet model stable while allowing per-machine customization.

## Setup Instructions

Follow these step-by-step instructions to get the system up and running:

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- Python 3.10+ (for the local AI backend)
- Ollama (installed locally for running the `llama2` or other local models). Download from [Ollama.com](https://ollama.com/).
  - After installing Ollama, you must pull and run the `llama2` model. Open a terminal and run:
    ```cmd
    ollama run llama2
    ```

### 2. Environment Variables & API Keys
To enable the "Hey Neo" voice wake word, you must configure your Picovoice/Porcupine API access keys.

1. Create a new file named `.env.local` in the root of the project.
2. Add your Porcupine access key inside the file:
   ```env
   NEXT_PUBLIC_PORCUPINE_ACCESS_KEY="YOUR_PICOVOICE_ACCESS_KEY_HERE"
   ```
*(You can obtain a free access key by signing up at the [Picovoice Console](https://console.picovoice.ai/).)*

### 3. Running the Backend
The backend powers the local AI engine and any mock data simulation services.
1. Navigate to the backend directory:
   ```cmd
   cd backend
   ```
2. Run the provided setup script:
   ```cmd
   .\setup_and_run.bat
   ```
   *(Alternatively, manually create a virtual environment, install requirements from `requirements.txt`, and run `app.py` or the specific backend server).*

### 4. Running the Frontend
1. Open a new terminal instance and stay in the root project directory (`AntiFault`).
2. Install all Node dependencies:
   ```cmd
   npm install
   ```
3. Start the Next.js development server:
   ```cmd
   npm run dev
   ```
4. Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

## Usage Tips
- Toggle the **"Hey Neo"** button in the AI Assistant panel (bottom right) to enable voice interactions.
- Try saying: *"Hey Neo, what is the status of Motor A?"*
- Try saying: *"Hey Neo, schedule maintenance for the hydraulic press."*
