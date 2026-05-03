# app/routes/auth_routes.py
from fastapi import APIRouter, HTTPException, status, Depends
from ..core.security import verify_password, create_access_token
from ..database import db
from ..models.user import UserLogin, Token
from datetime import timedelta
from ..core.config import settings

router = APIRouter(tags=["Authentication"])
users_collection = db.get_collection("users")

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    # Find user in MongoDB
    user = await users_collection.find_one({"username": credentials.username})
    
    # Verify existence and password
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Generate JWT
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"], "role": user.get("role", "user")},
        expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}