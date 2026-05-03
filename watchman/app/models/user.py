from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserCreate(BaseModel):
    full_name: str = Field(..., example="John Doe")
    email: EmailStr = Field(..., example="john.doe@sentrypod.io")
    username: str = Field(..., example="john_sentry")
    password: str = Field(..., min_length=8)
    role: str = Field(..., example="Admin")

class UserResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    username: str
    role: str