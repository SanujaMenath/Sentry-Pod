from fastapi import APIRouter, HTTPException, status, Depends 
from typing import List, Optional
from pydantic import BaseModel, Field
from ..models.user import UserCreate, UserResponse, UserRoleUpdate, UserProfileUpdate, UserPasswordUpdate
from ..services.user_service import (
    create_new_user, 
    assign_user_role, 
    get_user_by_id, 
    update_user_profile, 
    update_user_password,
    get_all_users
)
from ..core.dependencies import get_current_user, require_super_admin 

router = APIRouter(prefix="/users", tags=["Users"])


class AdminCardAndStatusResponse(BaseModel):
    id: str
    username: str
    email: str
    role_title: Optional[str] = Field(default="Super Admin")
    is_verified: bool = Field(default=True)
    two_factor_auth: bool = Field(default=True)
    role_permissions: str = Field(default="Full Access")

    class Config:
        populate_by_name = True

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def add_user(user: UserCreate):
    try:
        return await create_new_user(user)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) 

@router.put("/{user_id}/role", response_model=UserResponse)
async def update_role(
    user_id: str, 
    role_data: UserRoleUpdate, 
    admin_user: dict = Depends(require_super_admin) # 🔒 This blocks normal profiles!
):
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

@router.get("/", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(get_current_user)):
    try:
        return await get_all_users()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    
@router.get("/profile-cards-summary", response_model=AdminCardAndStatusResponse)
async def get_profile_cards_summary(current_user: dict = Depends(get_current_user)):
    """
    Extracts the authenticated session profile directly from the JWT 
    dependency to safely pull the user document from MongoDB.
    """
    try:
        # Convert MongoDB ObjectId safely to a standard string
        user_id_str = str(current_user["_id"])
        
        # Pulls data straight from your database using your service file's routine
        user_profile = await get_user_by_id(user_id_str)
        
        if "role_title" not in user_profile or not user_profile["role_title"]:
            user_profile["role_title"] = user_profile.get("role", "Super Admin").title()

        return user_profile
        
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Aggregation pipeline failure tracking status metrics: {str(e)}"
        )
    
@router.get("/security-activity")
async def get_security_activity(current_user: dict = Depends(get_current_user)):
    try:
        # Pull user data using  existing database helper function
        user_profile = await get_user_by_id(str(current_user["_id"]))
        
        # 2. Extract exclusively from the database. Returns an empty list if no logs exist yet.
        activities = user_profile.get("recent_activities", [])

        return activities[:3]
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database pipeline error tracking security activity logs: {str(e)}"
        )
