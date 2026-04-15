import numpy as np
from scipy.stats import norm

class InventoryOptimizer:
    def __init__(self, service_level=0.95, annual_demand=10000, ordering_cost=50, unit_cost=10, holding_rate=0.2, lead_time=7):
        self.service_level = service_level
        self.annual_demand = annual_demand
        self.ordering_cost = ordering_cost
        self.unit_cost = unit_cost
        self.holding_rate = holding_rate
        self.lead_time = lead_time
        self.z_score = norm.ppf(service_level)
    
    def calculate_policy(self, forecast_h, resid_std, on_hand):
        """
        Calculate inventory metrics based on forecast and current stock.
        """
        # Ensure sufficient forecast horizon
        lead_time_forecast = forecast_h[:self.lead_time].sum() if len(forecast_h) >= self.lead_time else forecast_h.sum()
        
        # Safety Stock formula: Z * sigma_L where sigma_L is std of error over L periods
        sigma_l = resid_std * np.sqrt(self.lead_time)
        safety_stock = self.z_score * sigma_l
        
        # Reorder Point (ROP) = expected demand over L + SS
        rop = lead_time_forecast + safety_stock
        
        # Economic Order Quantity
        # Holding cost H
        h_cost = self.unit_cost * self.holding_rate
        if h_cost > 0:
            eoq = np.sqrt((2 * self.annual_demand * self.ordering_cost) / h_cost)
        else:
            eoq = lead_time_forecast
            
        # Order Quantity
        order_quantity = max(0, max(eoq, rop - on_hand))
        
        return {
            "lead_time_demand": lead_time_forecast,
            "safety_stock": max(0, safety_stock),
            "reorder_point": rop,
            "eoq": eoq,
            "recommended_order_quantity": order_quantity
        }
