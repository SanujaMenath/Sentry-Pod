# watchman/app/api/v1/auth.py
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.security import verify_password, create_access_token
from app.models.user import UserLogin, Token
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings


router = APIRouter()

# Simple way to get DB access inside the route
def get_db():
    client = AsyncIOMotorClient(settings.DATABASE_URL)
    return client.sentry_nms

@router.post("/login", response_model=Token)
async def login(login_data: UserLogin):
    db = get_db()
    
    # 1. Find the user
    user = await db.users.find_one({"username": login_data.username})
    
    # 2. Check if user exists and password is correct
    if not user or not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    # 3. Create the token
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"]}
    )
    
    return {"access_token": access_token, "token_type": "bearer"}