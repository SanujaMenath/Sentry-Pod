from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserCreate(BaseModel):
    full_name: str = Field(..., example="Kaveesh Kumar")
    email: EmailStr = Field(..., example="kaveesh@sentrypod.io")
    username: str = Field(..., example="kaveesh")
    password: str = Field(..., min_length=8)    

class UserRoleUpdate(BaseModel):
    role: str = Field(..., example="Admin")

class UserResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    username: str
    role: str
    phone: Optional[str] = Field(None, example="+1 (555) 000-0000") 
    bio: Optional[str] = Field(None, example="Security Administrator")

class Token(BaseModel):
    access_token: str
    token_type: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, example="Admin User")
    email: Optional[EmailStr] = Field(None, example="admin@sentrypod.ai")
    phone: Optional[str] = Field(None, example="+1 (555) 000-0000")
    bio: Optional[str] = Field(None, example="Security Administrator")

class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)