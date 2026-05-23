from fastapi import HTTPException, status
from ..core.security import verify_password, create_access_token
from ..database import db
from datetime import timedelta
from ..core.config import settings

users_collection = db.get_collection("users")

async def authenticate_user(username, password):
    user = await users_collection.find_one({"username": username})
    
    if not user or not verify_password(password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        data={"sub": user["username"], "role": user.get("role", "user")},
        expires_delta=access_token_expires
    )
    
    return {"access_token": token, "token_type": "bearer"}