from fastapi import APIRouter, HTTPException, status
from ..models.user import UserCreate, UserResponse
from ..service.user_service import create_new_user

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def add_user(user: UserCreate):
    try:
        new_user = await create_new_user(user)
        return new_user
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))