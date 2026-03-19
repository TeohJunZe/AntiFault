@echo off
echo =======================================
echo Setting up FastAPI Backend Environment
echo =======================================

IF NOT EXIST "venv\Scripts\activate" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate

echo Installing dependencies (this may take a few minutes)...
pip install -r requirements.txt

echo.
echo =======================================
echo Starting FastAPI application...
echo =======================================
python main.py
