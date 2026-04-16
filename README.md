# 🛒 AI-Powered Retail Sales Forecasting & Inventory Optimization System

> Enterprise-style retail analytics platform | Demand forecasting | Inventory policy automation | Interactive decision dashboard

![Python](https://img.shields.io/badge/Python-3.8+-blue?style=flat-square&logo=python)
![Flask](https://img.shields.io/badge/Flask-Web%20App-green?style=flat-square&logo=flask)
![Machine Learning](https://img.shields.io/badge/ML-RandomForest-orange?style=flat-square)
![Domain](https://img.shields.io/badge/Domain-Retail%20Analytics-purple?style=flat-square)

## Overview

This project is a professional proof-of-concept for retail demand planning. It combines synthetic retail data generation, machine learning-based sales forecasting, and operations research style inventory calculations in a single web application.

The system helps answer a practical business question:

> How much stock should a store order today based on expected demand, lead time, and forecast uncertainty?

It also includes live dashboard capabilities for real-time inventory, sales, weather, supplier, competitor, and delivery tracking insights.

Instead of stopping at model metrics alone, the project turns forecast output into direct inventory actions such as:

- safety stock
- reorder point
- EOQ
- recommended order quantity

<img width="1845" height="888" alt="Screenshot 2026-04-16 125932" src="https://github.com/user-attachments/assets/7289d9b2-4835-4533-82ef-547ecd82ba9a" />


## Why This Matters

Retail operations constantly face two expensive problems:

- `Overstocking`: excess inventory increases storage cost and locks up working capital
- `Stock-outs`: lost sales reduce revenue and hurt customer experience

This project shows how AI and operations logic can work together to move from reactive replenishment to data-driven planning.

---

## System Architecture

```text
+-------------------------------+
| Synthetic Retail Data Engine  |
| - Multi-store demand          |
| - Promo effects               |
| - Weekend seasonality         |
| - Stock-out simulation        |
+-------------------------------+
                |
                v
+-------------------------------+
| Data Preprocessing            |
| - Parse dates                 |
| - Filter censored demand      |
| - Fill missing promo fields   |
+-------------------------------+
                |
                v
+-------------------------------+
| Feature Engineering           |
| - Lag features                |
| - Rolling means/std           |
| - Day-of-week and week        |
+-------------------------------+
                |
                v
+-------------------------------+
| Random Forest Forecast Model  |
| - Group-aware validation      |
| - MAE / RMSE tracking         |
| - Residual uncertainty        |
+-------------------------------+
                |
                v
+-------------------------------+
| Inventory Optimization Layer  |
| - Safety Stock                |
| - Reorder Point               |
| - EOQ                         |
| - Order Quantity              |
+-------------------------------+
                |
                v
+-------------------------------+
| Flask Dashboard & API         |
| - Forecast chart              |
| - What-if controls            |
| - PDF export                  |
| - Stock action guidance       |
+-------------------------------+
```

---

## Key Features

### Real-Time Decision Dashboard

- Interactive forecast visualization for the next 30 days
- Inventory recommendation cards for immediate planning decisions
- Stock health status labels such as healthy, warning, and critical
- Business-friendly UI for store and item selection

### AI + Inventory Logic

- Random Forest based retail demand model
- Lead-time aware reorder calculations
- Service-level based safety stock estimation
- EOQ calculation for cost-efficient replenishment

### Scenario Simulation

- Promotion slider for what-if demand uplift analysis
- Rain toggle to simulate weaker retail demand
- Holiday toggle to simulate demand spikes
- Dynamic recalculation of order quantity and risk level

### Operational Workflow

- Stock overview table for fast review
- Mock dispatch workflow for purchase orders
- Live order tracking style interface
- Executive PDF export for reporting

### Live Real-Time Insights

- Real-time analytics dashboard with trend charting
- Auto-refreshing sales and inventory updates
- Weather, supplier, and competitor tracking
- Business-ready KPI cards for instant decision support

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Flask, Python |
| Data Processing | pandas, numpy |
| Machine Learning | scikit-learn, RandomForestRegressor |
| Inventory Math | scipy |
| Model Persistence | joblib |
| Frontend | HTML5, CSS3, vanilla JavaScript |
| Visualization | Chart.js |
| Reporting | jsPDF |
| Mapping | Leaflet |

---

## How the Pipeline Works

### 1. Synthetic Data Generation

`src/data_generator.py` simulates a retail time series across multiple stores and items with:

- intermittent demand
- promotions
- discount percentages
- price variation
- stock-on-hand
- stock-out flags

This creates the training dataset:

```text
data/retail_timeseries.csv
```

### 2. Model Training

`src/train_model.py`:

- loads the generated CSV
- removes censored stock-out rows
- creates lag and rolling-window features
- uses `GroupShuffleSplit` to keep store-item groups intact
- trains a `RandomForestRegressor`
- stores model metrics and residual spread

Saved artifact:

```text
models/retail_forecast_model.pkl
```

### 3. Inventory Optimization

`src/inventory_logic.py` calculates:

- lead-time demand
- safety stock
- reorder point
- EOQ
- recommended order quantity

### 4. Web Application

`app/app.py` serves:

- `GET /` for the dashboard
- `POST /api/forecast` for forecast and policy output

If a trained model is not present yet, the app still works by generating simulated forecast values, which keeps the dashboard demo-ready.

---

## Project Structure

```text
Retail-Sales-Forecasting-Inventory-Optimization/
|
+-- app/
|   +-- app.py
|   +-- static/
|   |   +-- script.js
|   |   +-- style.css
|   +-- templates/
|       +-- index.html
|
+-- src/
|   +-- data_generator.py
|   +-- inventory_logic.py
|   +-- train_model.py
|
+-- .gitignore
+-- README.md
+-- requirements.txt
```

Generated during runtime:

```text
data/
models/
```

---

## Installation & Setup

### Prerequisites

- Python 3.8+
- pip
- modern browser

### Step 1: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/Retail-Sales-Forecasting-Inventory-Optimization.git
cd Retail-Sales-Forecasting-Inventory-Optimization
```

### Step 2: Create a Virtual Environment

```bash
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
```

macOS/Linux:

```bash
source venv/bin/activate
```

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 4: Generate the Dataset

Run from the `src` directory so the output paths land inside the project:

```bash
cd src
python data_generator.py
```

### Step 5: Train the Forecasting Model

Still inside `src`:

```bash
python train_model.py
```

### Step 6: Start the Flask App

From the project root:

```bash
cd ..\app
python app.py
```

Open:

```text
http://127.0.0.1:5000
```

---

## Dashboard Usage

1. Select a store and product
2. Enter current stock on hand
3. Set lead time
4. Run the forecast
5. Review the recommended order quantity, reorder point, safety stock, and EOQ
6. Use what-if controls to simulate promotion, rain, or holiday demand scenarios
7. Open the Real-Time Dashboard, Live Analytics, or Demand Patterns tabs for continuously updating insights
8. Export the results as a PDF report

---

## Example API Request

```bash
curl -X POST http://127.0.0.1:5000/api/forecast \
  -H "Content-Type: application/json" \
  -d "{\"store_id\":1,\"item_id\":1052,\"on_hand\":120,\"lead_time\":7,\"horizon\":30}"
```

Example response:

```json
{
  "dates": ["2026-04-15", "2026-04-16"],
  "forecast": [21.8, 18.4],
  "inventory_policy": {
    "safety_stock": 20.3,
    "reorder_point": 154.2,
    "eoq": 707.1,
    "recommended_order_quantity": 707.1
  }
}
```

---

## Model Outputs

The training script reports:

- Mean Absolute Error (`MAE`)
- Root Mean Squared Error (`RMSE`)
- Residual Standard Deviation

These metrics are saved with the model and used by the app to estimate uncertainty in inventory planning.

---

## Business Value

This project is useful as a portfolio demonstration of:

- machine learning for demand forecasting
- inventory optimization for retail operations
- full-stack Python application development
- applied analytics for business decision-making
- turning raw model output into action-oriented UI insights

---

## Limitations

- The current dashboard uses simulated forward forecast generation in the API route
- The dataset is synthetic and designed for demonstration
- Frontend libraries are loaded from CDN in the browser
- There is not yet a persistent database or automated test suite

---

## Future Improvements

- Connect the trained model to true multi-step forecasting in the API
- Add persistent storage for forecast history and user actions
- Add authentication and role-based access
- Support multi-store benchmarking and trend comparisons
- Add Docker deployment
- Extend to advanced models such as XGBoost or LightGBM

---

## Author

**Harshit V Shah**  
Email: [harshitvshah2554@gmail.com](mailto:harshitvshah2554@gmail.com)  
LinkedIn: [harshit-v-shah375](https://www.linkedin.com/in/harshit-v-shah375/?skipRedirect=true)  
GitHub: [Harshit1975](https://github.com/Harshit1975)
