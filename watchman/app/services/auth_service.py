from fastapi import HTTPException, status
from ..core.security import verify_password, create_access_token
from ..database import users_collection
from datetime import timedelta
from ..core.config import settings
import logging

logger = logging.getLogger(__name__)

async def authenticate_user(username, password):
    try:
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )