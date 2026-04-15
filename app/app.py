from flask import Flask, render_template, request, jsonify
import sys
import os
import joblib
import pandas as pd
import numpy as np

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))
from inventory_logic import InventoryOptimizer

app = Flask(__name__)

# Try loading the model
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'models', 'retail_forecast_model.pkl')
try:
    model_data = joblib.load(MODEL_PATH)
    model = model_data["model"]
    features = model_data["features"]
    metrics = model_data["metrics"]
    print("Model loaded successfully.")
except Exception as e:
    print(f"Warning: Model not found or error loading it: {e}")
    model, features, metrics = None, None, None

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/forecast", methods=["POST"])
def get_forecast():
    data = request.json
    store_id = int(data.get("store_id", 1))
    item_id = int(data.get("item_id", 1))
    on_hand = int(data.get("on_hand", 50))
    lead_time = int(data.get("lead_time", 7))
    horizon = int(data.get("horizon", 30))
    
    # Normally we would fetch the latest features for this SKU-Store.
    # For simulation, we will generate dummy predictions to show the workflow if model is missing.
    # Or use a simple mean prediction if model is not perfectly aligned here.
    
    forecast_arr = np.random.normal(loc=20.0, scale=5.0, size=horizon)
    forecast_arr = np.maximum(0, forecast_arr) # No negative demand
    
    if model is not None:
        # In a real app we'd construct the feature matrix here
        # E.g. using the latest rows from the DB and predicting `horizon` days ahead
        # Using realistic simulation bounds based on MAE
        resid_std = metrics.get('resid_std', 5.0)
    else:
        resid_std = float(np.std(forecast_arr))

    # Optimization
    opt = InventoryOptimizer(lead_time=lead_time)
    policy = opt.calculate_policy(forecast_arr, resid_std, on_hand)
    
    dates = pd.date_range(start=pd.Timestamp.today(), periods=horizon).strftime('%Y-%m-%d').tolist()
    
    response = {
        "dates": dates,
        "forecast": forecast_arr.tolist(),
        "inventory_policy": {
            "safety_stock": float(policy["safety_stock"]),
            "reorder_point": float(policy["reorder_point"]),
            "eoq": float(policy["eoq"]),
            "recommended_order_quantity": float(policy["recommended_order_quantity"])
        }
    }
    
    return jsonify(response)

if __name__ == "__main__":
    app.run(debug=True, port=5000)
