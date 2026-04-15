import pandas as pd
import numpy as np
import joblib
import os
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import GroupShuffleSplit

def make_features(g):
    g = g.sort_values("date")
    for L in (1, 7, 14):
        g[f"lag_{L}"] = g["qty_sold"].shift(L)
    for W in (7, 14, 28):
        g[f"rollmean_{W}"] = g["qty_sold"].shift(1).rolling(W).mean()
        g[f"rollstd_{W}"] = g["qty_sold"].shift(1).rolling(W).std()
    
    g["dow"] = g["date"].dt.dayofweek
    g["week"] = g["date"].dt.isocalendar().week.astype(int)
    return g

def train():
    data_path = os.path.join("..", "data", "retail_timeseries.csv")
    if not os.path.exists(data_path):
        print("Data file not found. Generate it first.")
        return
        
    print("Loading data...")
    df = pd.read_csv(data_path, parse_dates=["date"])
    
    # Filter censored demand
    df = df[df.get("stockout_flag", 0) == 0].copy()
    
    # Handle missing promos
    for c in ["on_promo", "discount_pct", "price"]:
        if c in df:
            df[c] = df[c].fillna(0)
    
    print("Engineering features...")
    df = df.groupby(["store_id", "item_id"], group_keys=False).apply(make_features).dropna()
    
    feat_cols = [c for c in df.columns if c not in ["qty_sold", "date", "stockout_flag"]]
    X, y = df[feat_cols], df["qty_sold"]
    groups = df["store_id"].astype(str) + "_" + df["item_id"].astype(str)
    
    # Split using GroupShuffleSplit to keep SKU-Stores intact
    gss = GroupShuffleSplit(test_size=0.2, random_state=13)
    tr_idx, te_idx = next(gss.split(X, y, groups))
    Xtr, Xte, ytr, yte = X.iloc[tr_idx], X.iloc[te_idx], y.iloc[tr_idx], y.iloc[te_idx]
    
    print("Training Random Forest model...")
    rf = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=13, n_jobs=-1)
    rf.fit(Xtr, ytr)
    
    pred = rf.predict(Xte)
    mae = mean_absolute_error(yte, pred)
    rmse = np.sqrt(mean_squared_error(yte, pred))
    resid_std = float(np.std(yte - pred))
    print(f"Validation MAE: {mae:.2f}")
    print(f"Validation RMSE: {rmse:.2f}")
    
    # Ensure models dir exists
    os.makedirs(os.path.join("..", "models"), exist_ok=True)
    
    joblib.dump({
        "model": rf,
        "features": feat_cols,
        "metrics": {"mae": mae, "rmse": rmse, "resid_std": resid_std}
    }, os.path.join("..", "models", "retail_forecast_model.pkl"))
    
    print("Model saved successfully in models/retail_forecast_model.pkl")

if __name__ == "__main__":
    train()
