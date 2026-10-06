import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import joblib
import numpy as np
import uvicorn

# Initialize FastAPI app
app = FastAPI(title="Water Contamination Risk Prediction API",
              description="API for predicting water contamination risk using XGBoost model",
              version="1.0.0")

# Define the expected input features based on the model training
FEATURE_NAMES = [
    'Average Water Speed',
    'Average Water Direction',
    'Chlorophyll',
    'Temperature',
    'Dissolved Oxygen',
    'Dissolved Oxygen (%Saturation)',
    'pH',
    'Salinity',
    'Specific Conductance',
    'Turbidity',
    'Turbidity_max',
    'Rainfall (mm)',
    'Air Temperature (degC)',
    'Relative Humidity (%)',
    'Wind Speed (m/s)',
    'Rainfall_6H',
    'Turbidity_delta_3h'
]

# Pydantic model for input validation
from pydantic import Field

class WaterFeatures(BaseModel):
    Average_Water_Speed: float = Field(..., alias="Average Water Speed")
    Average_Water_Direction: float = Field(..., alias="Average Water Direction")
    Chlorophyll: float
    Temperature: float
    Dissolved_Oxygen: float = Field(..., alias="Dissolved Oxygen")
    Dissolved_Oxygen_Saturation: float = Field(..., alias="Dissolved Oxygen (%Saturation)")
    pH: float
    Salinity: float
    Specific_Conductance: float = Field(..., alias="Specific Conductance")
    Turbidity: float
    Turbidity_max: float
    Rainfall_mm: float = Field(..., alias="Rainfall (mm)")
    Air_Temperature_degC: float = Field(..., alias="Air Temperature (degC)")
    Relative_Humidity: float = Field(..., alias="Relative Humidity (%)")
    Wind_Speed_m_s: float = Field(..., alias="Wind Speed (m/s)")
    Rainfall_6H: float
    Turbidity_delta_3h: float

    model_config = {
        "populate_by_name": True
    }

# Global variable for model
model = None

def load_model():
    """Load the trained XGBoost model"""
    global model
    if model is None:
        try:
            # Use path relative to this file for robustness
            model_path = Path(__file__).parent / "xgb_water_model.pkl"
            if not model_path.exists():
                raise FileNotFoundError(f"Model file not found at {model_path}")
            model = joblib.load(model_path)
            print(f"Model loaded successfully from {model_path}")
        except Exception as e:
            print(f"Error loading model: {e}")
            raise e
    return model

@app.on_event("startup")
async def startup_event():
    """Load model on startup"""
    load_model()

@app.get("/")
async def root():
    """Root endpoint - serve the frontend"""
    return FileResponse('frontend/index.html')

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Try to load model to verify it's accessible
        model = load_model()
        return {
            "status": "healthy",
            "model_loaded": model is not None,
            "message": "Water contamination risk prediction API is running"
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Model loading failed: {str(e)}")

@app.post("/api/predict")
async def predict_risk(features: WaterFeatures):
    """
    Predict water contamination risk based on input features
    """
    try:
        # Load model if not already loaded
        model = load_model()

        # Convert input to array in the correct order
        feature_dict = features.dict(by_alias=True)

        # Create array in the exact order expected by the model
        feature_array = np.array([[feature_dict[name] for name in FEATURE_NAMES]])

        # Get prediction probability
        risk_probability = model.predict_proba(feature_array)[0][1]

        # Apply the 0.35 threshold as used in the original Streamlit app
        is_high_risk = risk_probability > 0.35
        risk_label = "High Risk" if is_high_risk else "Low Risk"

        return {
            "risk": risk_label,
            "probability": float(risk_probability),
            "threshold": 0.35,
            "message": f"Water contamination risk is {risk_label.lower()} with probability {risk_probability:.3f}"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

# Mount static files for frontend
app.mount("/static", StaticFiles(directory="frontend"), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8099)