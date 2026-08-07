from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.core.config import settings
from app.database import db  # ✅ Added: Import database connection

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
users_collection = db.get_collection("users") 

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = await users_collection.find_one({"username": username})
    if user is None:
        raise credentials_exception
        
    return user 

def require_super_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "Super Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Super Admin authorization required."
        )
    return current_user

def require_network_admin(current_user: dict = Depends(get_current_user)):
    allowed = ["Super Admin", "Network Admin"]
    if current_user.get("role") not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Network Admin authorization required."
        )
    return current_user

def require_security_admin(current_user: dict = Depends(get_current_user)):
    allowed = ["Super Admin", "Network Admin", "Security Admin"]
    if current_user.get("role") not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Security Admin authorization required."
        )
    return current_user

def require_auditor(current_user: dict = Depends(get_current_user)):
    allowed = ["Super Admin", "Auditor"]
    if current_user.get("role") not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Auditor authorization required."
        )
    return current_user