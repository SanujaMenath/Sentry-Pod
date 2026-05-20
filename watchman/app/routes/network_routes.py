from fastapi import APIRouter
from typing import List
from app.models.telemetry import TrafficDataPoint
from datetime import datetime, timedelta
import random

router = APIRouter(prefix="/api/network", tags=["Network Telemetry"])

@router.get("/traffic-history", response_model=List[TrafficDataPoint])
async def get_traffic_history():
    data = []
    now = datetime.now()
    
    # Generate data points covering the last 24 hours
    for i in range(12, -1, -1):
        target_time = now - timedelta(hours=i * 2)
        formatted_time = target_time.strftime("%H:%M")
        
        hour = target_time.hour
        if 8 <= hour <= 18:
            traffic_value = 100
        else:
            traffic_value = 10
            
        data.append(TrafficDataPoint(time=formatted_time, traffic=traffic_value))
        
    return data