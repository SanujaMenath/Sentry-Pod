from pydantic import BaseModel

class TrafficDataPoint(BaseModel):
    time: str
    traffic: int