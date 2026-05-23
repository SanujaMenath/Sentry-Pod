from fastapi import APIRouter, Depends
from ..models.user import UserLogin, Token
from ..services.auth_service import authenticate_user

router = APIRouter(tags=["Authentication"])

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    # The route now just calls the service
    return await authenticate_user(credentials.username, credentials.password)