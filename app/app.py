from flask import Flask, render_template, request, jsonify
import sys
import os
import joblib
import pandas as pd
import numpy as np
import json
import random
import time
from datetime import datetime, timedelta
import threading
from flask_socketio import SocketIO, emit
import requests

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))
from inventory_logic import InventoryOptimizer

app = Flask(__name__)
app.config['SECRET_KEY'] = 'retail-ai-secret-key-2026'
socketio = SocketIO(app, cors_allowed_origins="*")

# Attempt to load a saved forecast model
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'models', 'retail_forecast_model.pkl')
try:
    model_data = joblib.load(MODEL_PATH)
    model = model_data.get("model")
    features = model_data.get("features")
    metrics = model_data.get("metrics", {})
    print("Model loaded successfully.")
except Exception as e:
    print(f"Warning: Model not found or error loading it: {e}")
    model, features, metrics = None, None, {}

# Global data stores for real-time features
inventory_data = {}
sales_data = {"total_today": 0, "transactions": []}
weather_data = {}
competitor_data = {}
supplier_data = {}
system_health = {"cpu": 45, "memory": 62, "response_time": 120}

# Mock data generators
def generate_inventory_data():
    stores = ["Store 1 (Mumbai)", "Store 2 (Pune)", "Store 3 (Delhi)", "Store 4 (Bangalore)"]
    products = [
        {"id": 1052, "name": "Nike Air Force 1", "category": "Footwear"},
        {"id": 1088, "name": "Sony Bravia 55\" TV", "category": "Electronics"},
        {"id": 1015, "name": "Kellogg's Corn Flakes", "category": "Food"},
        {"id": 2004, "name": "Samsung Galaxy S24", "category": "Electronics"},
        {"id": 3001, "name": "Levi's Jeans", "category": "Clothing"},
        {"id": 4002, "name": "Apple MacBook", "category": "Electronics"}
    ]

    for store in stores:
        inventory_data[store] = {}
        for product in products:
            current_stock = random.randint(0, 200)
            reorder_point = random.randint(20, 50)
            max_stock = random.randint(150, 300)
            status = "Normal"
            if current_stock <= reorder_point:
                status = "Low Stock"
            elif current_stock <= reorder_point * 0.5:
                status = "Critical"

            inventory_data[store][product["id"]] = {
                "name": product["name"],
                "category": product["category"],
                "current_stock": current_stock,
                "reorder_point": reorder_point,
                "max_stock": max_stock,
                "status": status,
                "last_updated": datetime.now().isoformat()
            }

def generate_sales_transaction():
    products = [
        {"id": 1052, "name": "Nike Air Force 1", "price": 8500},
        {"id": 1088, "name": "Sony Bravia 55\" TV", "price": 65000},
        {"id": 1015, "name": "Kellogg's Corn Flakes", "price": 120},
        {"id": 2004, "name": "Samsung Galaxy S24", "price": 75000},
        {"id": 3001, "name": "Levi's Jeans", "price": 3200},
        {"id": 4002, "name": "Apple MacBook", "price": 125000}
    ]

    stores = ["Store 1 (Mumbai)", "Store 2 (Pune)", "Store 3 (Delhi)", "Store 4 (Bangalore)"]
    product = random.choice(products)
    store = random.choice(stores)
    quantity = random.randint(1, 5)
    total = product["price"] * quantity

    transaction = {
        "id": f"TXN-{int(time.time())}-{random.randint(1000,9999)}",
        "timestamp": datetime.now().isoformat(),
        "store": store,
        "product_id": product["id"],
        "product_name": product["name"],
        "quantity": quantity,
        "unit_price": product["price"],
        "total": total,
        "payment_method": random.choice(["Card", "UPI", "Cash"])
    }

    sales_data["transactions"].insert(0, transaction)
    sales_data["total_today"] += total

    # Keep only last 50 transactions
    if len(sales_data["transactions"]) > 50:
        sales_data["transactions"] = sales_data["transactions"][:50]

    return transaction

def update_weather_data():
    cities = {
        "Mumbai": {"lat": 19.0760, "lng": 72.8777},
        "Pune": {"lat": 18.5204, "lng": 73.8567},
        "Delhi": {"lat": 28.7041, "lng": 77.1025},
        "Bangalore": {"lat": 12.9716, "lng": 77.5946}
    }

    for city, coords in cities.items():
        # Mock weather data (in real app, use weather API)
        weather_conditions = ["Sunny", "Cloudy", "Rainy", "Thunderstorm", "Clear"]
        weather_data[city] = {
            "temperature": random.randint(20, 35),
            "humidity": random.randint(40, 90),
            "condition": random.choice(weather_conditions),
            "wind_speed": random.randint(5, 25),
            "last_updated": datetime.now().isoformat(),
            "forecast": [
                {"day": "Today", "temp": random.randint(20, 35), "condition": random.choice(weather_conditions)},
                {"day": "Tomorrow", "temp": random.randint(20, 35), "condition": random.choice(weather_conditions)},
                {"day": "Day 3", "temp": random.randint(20, 35), "condition": random.choice(weather_conditions)}
            ]
        }

def update_competitor_data():
    competitors = ["Amazon", "Flipkart", "Reliance Digital", "Croma", "Vijay Sales"]
    products = [
        {"id": 1052, "name": "Nike Air Force 1", "our_price": 8500},
        {"id": 1088, "name": "Sony Bravia 55\" TV", "our_price": 65000},
        {"id": 2004, "name": "Samsung Galaxy S24", "our_price": 75000},
        {"id": 4002, "name": "Apple MacBook", "our_price": 125000}
    ]

    for product in products:
        competitor_data[product["id"]] = {
            "product_name": product["name"],
            "our_price": product["our_price"],
            "competitors": {}
        }

        for competitor in competitors:
            # Simulate competitor prices (some higher, some lower)
            price_variation = random.uniform(0.85, 1.15)
            competitor_price = round(product["our_price"] * price_variation)
            competitor_data[product["id"]]["competitors"][competitor] = {
                "price": competitor_price,
                "in_stock": random.choice([True, True, True, False]),  # 75% in stock
                "last_updated": datetime.now().isoformat()
            }

def update_supplier_data():
    suppliers = ["Samsung India", "Sony India", "Nike India", "Kellogg's India", "Apple India"]
    for supplier in suppliers:
        supplier_data[supplier] = {
            "name": supplier,
            "status": random.choice(["Active", "Active", "Active", "Delayed", "On Hold"]),
            "lead_time_days": random.randint(3, 14),
            "reliability_score": random.randint(75, 98),
            "last_delivery": (datetime.now() - timedelta(days=random.randint(1, 7))).isoformat(),
            "next_delivery": (datetime.now() + timedelta(days=random.randint(1, 5))).isoformat(),
            "products_available": random.randint(50, 200)
        }

def update_system_health():
    system_health["cpu"] = random.randint(20, 80)
    system_health["memory"] = random.randint(40, 85)
    system_health["response_time"] = random.randint(80, 200)
    system_health["last_updated"] = datetime.now().isoformat()

# Initialize data
generate_inventory_data()
update_weather_data()
update_competitor_data()
update_supplier_data()
update_system_health()

# Background tasks
def run_background_tasks():
    while True:
        time.sleep(30)  # Update every 30 seconds
        generate_sales_transaction()
        update_weather_data()
        update_competitor_data()
        update_supplier_data()
        update_system_health()

        # Emit real-time updates via WebSocket
        socketio.emit('inventory_update', inventory_data)
        socketio.emit('sales_update', sales_data)
        socketio.emit('weather_update', weather_data)
        socketio.emit('competitor_update', competitor_data)
        socketio.emit('supplier_update', supplier_data)
        socketio.emit('system_health_update', system_health)
        socketio.emit('analytics_update', calculate_analytics())

# Start background thread
bg_thread = threading.Thread(target=run_background_tasks, daemon=True)
bg_thread.start()

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

@app.route("/api/tracking", methods=["GET"])
def get_tracking():
    # Mock tracking data for demonstration
    tracking_data = [
        {
            "order_id": "88392",
            "product": "Samsung Galaxy S24 Ultra",
            "quantity": 200,
            "destination": "Store 1 (Reliance Smart Mumbai)",
            "status": "In Transit",
            "progress": 75,
            "days_remaining": 2,
            "tracking_id": "TRK-2026-04567",
            "shipping_location": "Chennai Manufacturing Hub",
            "current_location": {"lat": 13.0827, "lng": 80.2707, "name": "Chennai Port"},
            "route": [
                {"lat": 13.0827, "lng": 80.2707, "name": "Chennai Port", "status": "Departed"},
                {"lat": 19.0760, "lng": 72.8777, "name": "Mumbai Warehouse", "status": "In Transit"},
                {"lat": 19.0760, "lng": 72.8777, "name": "Reliance Smart Store", "status": "Pending"}
            ]
        },
        {
            "order_id": "88391",
            "product": "Kellogg's Corn Flakes 500g",
            "quantity": 1000,
            "destination": "Warehouse Main",
            "status": "Processing at Factory",
            "progress": 25,
            "days_remaining": 6,
            "tracking_id": "TRK-2026-04566",
            "shipping_location": "Pune Production Facility",
            "current_location": {"lat": 18.5204, "lng": 73.8567, "name": "Pune Factory"},
            "route": [
                {"lat": 18.5204, "lng": 73.8567, "name": "Pune Factory", "status": "Processing"},
                {"lat": 19.0760, "lng": 72.8777, "name": "Mumbai Warehouse", "status": "Pending"}
            ]
        }
    ]
    return jsonify(tracking_data)

@app.route("/api/inventory", methods=["GET"])
def get_inventory():
    return jsonify(inventory_data)

@app.route("/api/sales", methods=["GET"])
def get_sales():
    return jsonify(sales_data)

@app.route("/api/weather", methods=["GET"])
def get_weather():
    return jsonify(weather_data)

@app.route("/api/competitors", methods=["GET"])
def get_competitors():
    return jsonify(competitor_data)

@app.route("/api/suppliers", methods=["GET"])
def get_suppliers():
    return jsonify(supplier_data)

@app.route("/api/system-health", methods=["GET"])
def calculate_analytics():
    total_inventory_value = 0
    low_stock_items = 0
    total_sales_today = sales_data["total_today"]
    transaction_count = len(sales_data["transactions"])

    for store_data in inventory_data.values():
        for item_data in store_data.values():
            # Estimate value (mock calculation)
            estimated_value = item_data["current_stock"] * random.randint(100, 10000)
            total_inventory_value += estimated_value
            if item_data["status"] in ["Low Stock", "Critical"]:
                low_stock_items += 1

    # Build a small time-series for charting
    now = datetime.now()
    label_count = 7
    trend_labels = [
        (now - timedelta(minutes=10 * (label_count - 1 - i))).strftime("%H:%M")
        for i in range(label_count)
    ]

    revenue_trend = []
    transaction_trend = []
    base_sales = total_sales_today / max(label_count, 1)
    base_transactions = transaction_count / max(label_count, 1)

    for idx in range(label_count):
        multiplier = 0.8 + 0.4 * random.random()
        revenue_trend.append(round(base_sales * (0.7 + idx * 0.05) * multiplier))
        transaction_trend.append(max(0, round(base_transactions * (0.7 + idx * 0.05) * multiplier)))

    analytics = {
        "inventory_value": total_inventory_value,
        "low_stock_alerts": low_stock_items,
        "sales_today": total_sales_today,
        "transaction_count": transaction_count,
        "avg_transaction_value": total_sales_today / max(transaction_count, 1),
        "system_uptime": "99.9%",
        "last_updated": datetime.now().isoformat(),
        "trend_labels": trend_labels,
        "revenue_trend": revenue_trend,
        "transaction_trend": transaction_trend
    }

    return analytics

@app.route("/api/analytics", methods=["GET"])
def get_analytics():
    return jsonify(calculate_analytics())

@app.route("/api/demand-patterns", methods=["GET"])
def get_demand_patterns():
    # Mock real-time demand patterns
    patterns = {
        "trending_products": [
            {"name": "Samsung Galaxy S24", "demand_increase": 45, "social_mentions": 1250},
            {"name": "Nike Air Force 1", "demand_increase": 32, "social_mentions": 890},
            {"name": "Sony Bravia TV", "demand_increase": 28, "social_mentions": 675}
        ],
        "seasonal_trends": {
            "summer_items": ["AC", "Fans", "Sunglasses"],
            "monsoon_items": ["Raincoats", "Umbrellas", "Home Appliances"],
            "festival_items": ["Sweets", "Decorations", "Electronics"]
        },
        "price_sensitivity": {
            "electronics": "High",
            "clothing": "Medium",
            "food": "Low"
        },
        "last_updated": datetime.now().isoformat()
    }
    return jsonify(patterns)

# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('status', {'message': 'Connected to real-time updates'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('request_inventory_update')
def handle_inventory_request():
    emit('inventory_update', inventory_data)

@socketio.on('request_sales_update')
def handle_sales_request():
    emit('sales_update', sales_data)

if __name__ == "__main__":
    socketio.run(app, debug=True, port=5000)
