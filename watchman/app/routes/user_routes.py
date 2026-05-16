from fastapi import APIRouter, HTTPException, status, Depends 
from ..models.user import UserCreate, UserResponse, UserRoleUpdate, UserProfileUpdate, UserPasswordUpdate
from ..services.user_service import (
    create_new_user, 
    assign_user_role, 
    get_user_by_id, 
    update_user_profile, 
    update_user_password
)
from ..core.dependencies import get_current_user 

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def add_user(user: UserCreate):
    try:
        return await create_new_user(user)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) 

@router.put("/{user_id}/role", response_model=UserResponse)
async def update_role(user_id: str, role_data: UserRoleUpdate):
    try:
        return await assign_user_role(user_id, role_data.role)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@router.get("/me", response_model=UserResponse)
async def read_user_me(current_user: dict = Depends(get_current_user)):
    user = await get_user_by_id(str(current_user["_id"]))
    return user

@router.put("/me", response_model=UserResponse)
async def update_profile(
    profile_data: UserProfileUpdate, 
    current_user: dict = Depends(get_current_user)
):
    return await update_user_profile(str(current_user["_id"]), profile_data)

@router.put("/me/password")
async def change_password(
    password_data: UserPasswordUpdate, 
    current_user: dict = Depends(get_current_user)
):
    return await update_user_password(str(current_user["_id"]), password_data)