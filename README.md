# Retail Sales Forecasting & Inventory Optimization System

![Dashboard Preview](images/dashboard_preview.png)

## 📌 Project Overview
An end-to-end Machine Learning and Operations (MLOps) pipeline for retail businesses to forecast item-level sales and translate these forecasts into optimal inventory replenishment decisions. This system effectively reduces stock-outs and improves working capital efficiency by right-sizing inventory across stores.

### ❓ Problem Statement
Retailers face two massive operational challenges:
1. **Overstocking:** Ties up working capital in unsold inventory, leading to markdowns and holding cost losses.
2. **Stock-outs:** Plunges customer satisfaction and directly impacts revenue.

### 💡 Business Value & Industry Relevance
Top retailers like Amazon, D-Mart, and Walmart use forecasting + inventory science. 
This project serves as a full Proof-of-Concept simulating robust solutions to handle intermittent demand, optimize safety thresholds dynamically based on forecasted error margins, and generate Recommended Order Quantities (ROQ) for supply chain planners.

---

## 🛠️ Tech Stack
This project leverages **Python** for machine learning, data processing, and backend API routes, combined with a **Vanilla JavaScript / HTML / CSS** frontend for zero-dependency, lightning-fast rendering.
- **Data Engineering:** `pandas`, `numpy`
- **Machine Learning:** `scikit-learn`, `RandomForestRegressor`, `scipy` (Statistics)
- **Backend Infrastructure:** `Flask`, `joblib`
- **Frontend Dashboard:** HTML5, Modern CSS (Glassmorphism), Vanilla JS, `Chart.js`

---

## 🏗️ Architecture

```text
[ Synthetic Retail Data ] -> (CSV generation script simulating noise & missingness)
        │
        ▼
[ Data Preprocessing ] -> (Censor stock-outs, handle NaNs, feature engineering: lags, rolls)
        │
        ▼
[ Machine Learning Model ] -> (Random Forest predicting localized sku-store demand)
        │
        ▼
[ Inventory Policy Engine ] -> (Calculates Safety Stock, ROP, EOQ from forecast distribution bounds)
        │
        ▼
[ Flask REST API ] -> (Exposes ML routes to the UI)
        │
        ▼
[ Dynamic Web Dashboard ] -> (Real-time analytics and inventory action alerts)
```

---

## 📂 Folder Structure

```
Retail-Sales-Forecasting-Inventory-Optimization/
│
├── data/                       # (Generated datasets)
├── notebooks/                  # Experimental Jupyter logs & EDA charts
├── src/                        # Core algorithmic modules
│   ├── data_generator.py       # Simulates demand histories
│   ├── train_model.py          # Builds and saves the ML pipeline
│   └── inventory_logic.py      # Operations equations (ROP, SS, EOQ)
├── models/                     # Serialized Model binaries (.pkl)
├── app/                        # Web Dashboard Server
│   ├── app.py                  # Flask Application
│   ├── static/
│   │   ├── style.css           # Glass UI Styling
│   │   └── script.js           # Chart and Controller Logic
│   └── templates/
│       └── index.html          # Frontend Layout
├── README.md
└── requirements.txt
```

---

## 🚀 Installation & How to Run

### Step 1: Clone Repository
```bash
git clone https://github.com/your-username/Retail-Sales-Forecasting-Inventory-Optimization.git
cd Retail-Sales-Forecasting-Inventory-Optimization
```

### Step 2: Environment Setup
```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### Step 3: Run Virtual Simulation Workflow
1. **Generate the Dataset:**
```bash
python src/data_generator.py
```
2. **Train the Forecaster:**
```bash
python src/train_model.py
```

### Step 4: Start the Dashboard
```bash
cd app
python app.py
```
Go to `http://127.0.0.1:5000` to view the Real-Time Web Application.

---

## 📈 Results & Features Let us know!

1. **Dashboard:** Interactive parameters to query any Store-SKU to instantly visualize a 30-day forecasted run.
2. **Operations Focus:** Translates abstract ML Metrics (like MAE) strictly to Business Operations logic.

---

## 🔮 Future Improvements
1. Multidimensional forecasting via XGBoost.
2. Dockerization of the application for cloud deployment on AWS / GCP.
3. Incorporate price-elasticity optimization.

---

**Author:** [Your Name] | **LinkedIn:** [Your Profile Link]
