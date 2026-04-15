import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta

def generate_synthetic_data(num_stores=3, num_items=10, days=365, output_dir="../data"):
    os.makedirs(output_dir, exist_ok=True)
    np.random.seed(42)
    
    date_rng = pd.date_range(start='2023-01-01', periods=days, freq='D')
    
    data = []
    
    for store in range(1, num_stores + 1):
        for item in range(1, num_items + 1):
            # Base demand characteristics
            is_intermittent = np.random.rand() < 0.2  # 20% items are rare
            base_qty = np.random.randint(5, 50) if not is_intermittent else np.random.randint(0, 5)
            
            for date in date_rng:
                # Seasonality (weekend bump, holiday bumps)
                weekday = date.weekday()
                weekend_multiplier = 1.3 if weekday >= 5 else 1.0
                
                # Promo
                on_promo = 1 if np.random.rand() < 0.1 else 0
                promo_multiplier = 1.5 if on_promo else 1.0
                
                # Noise
                noise = np.random.normal(1.0, 0.2)
                
                qty = int(base_qty * weekend_multiplier * promo_multiplier * noise)
                
                # Intermittent demand (zeros)
                if is_intermittent and np.random.rand() < 0.8:
                    qty = 0
                
                if qty < 0:
                    qty = 0
                    
                # Simulate stockouts censoring
                stock_on_hand = np.random.randint(0, 100)
                stockout_flag = 1 if stock_on_hand == 0 else 0
                if stockout_flag:
                    qty = 0
                
                data.append({
                    "date": date,
                    "store_id": store,
                    "item_id": item,
                    "qty_sold": qty,
                    "on_promo": on_promo,
                    "discount_pct": np.random.choice([0, 10, 20]) if on_promo else 0,
                    "price": np.random.uniform(10.0, 100.0),
                    "stock_on_hand": stock_on_hand,
                    "stockout_flag": stockout_flag
                })
                
    df = pd.DataFrame(data)
    file_path = os.path.join(output_dir, "retail_timeseries.csv")
    df.to_csv(file_path, index=False)
    print(f"Synthetic data generated successfully at {file_path}")
    return df

if __name__ == "__main__":
    generate_synthetic_data()
