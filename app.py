import streamlit as st
import pandas as pd
import joblib

st.title("🌊 Water Risk Intelligence System")
st.subheader("3-Hour Ahead Contamination Risk Forecast")

# Load trained model
model = joblib.load("xgb_water_model.pkl")

# Load merged dataset
df = pd.read_csv("final_merged_dataset.csv")

# Feature columns (same as training)
X_cols = [
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

# Take latest row
latest_data = df[X_cols].tail(1)

demo_mode = st.checkbox("Show High-Risk Scenario")

if demo_mode:
    latest_data["Turbidity"] = 12
    latest_data["Rainfall_6H"] = 20

st.info("Monitoring Location: Brisbane River - Colmslie Station")

# Predict risk probability
risk_prob = model.predict_proba(latest_data)[0][1]

st.metric("Predicted Contamination Risk Probability", f"{risk_prob:.2f}")

if risk_prob > 0.35:
    st.error("⚠️ HIGH RISK ALERT: Contamination likely in next 3 hours!")
else:
    st.success("✅ Water conditions normal")

st.write("### Latest Sensor Inputs")
st.dataframe(latest_data)

