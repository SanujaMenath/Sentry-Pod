from passlib.context import CryptContext
from ..database import db
from ..models.user import UserCreate, UserProfileUpdate, UserPasswordUpdate
from bson import ObjectId 
from fastapi import HTTPException, status

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
users_collection = db.get_collection("users")

def format_user_response(user_dict: dict) -> dict:
    if user_dict:
        user_dict["id"] = str(user_dict["_id"])
    return user_dict

async def create_new_user(user_data: UserCreate):
    normalized_username = user_data.username.lower()
    
    existing = await users_collection.find_one({"$or": [{"username": normalized_username}, {"email": user_data.email}]})
    if existing:
        raise Exception("Username or Email already registered")

    hashed_password = pwd_context.hash(user_data.password)
    user_dict = user_data.model_dump()
    user_dict["username"] = normalized_username
    user_dict["password"] = hashed_password
    user_dict["role"] = "pending" 
    
    result = await users_collection.insert_one(user_dict)
    return format_user_response(user_dict)

async def assign_user_role(user_id: str, new_role: str):
    result = await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"role": new_role}}
    )
    if result.modified_count == 0:
        raise Exception("User not found or role unchanged")
        
    updated_user = await users_collection.find_one({"_id": ObjectId(user_id)})
    return format_user_response(updated_user)

async def get_user_by_id(user_id: str):
    user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return format_user_response(user)

async def update_user_profile(user_id: str, profile_data: UserProfileUpdate):
    update_dict = {k: v for k, v in profile_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No valid update data provided")
        
    await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_dict}
    )
    return await get_user_by_id(user_id)

async def update_user_password(user_id: str, password_data: UserPasswordUpdate):
    user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not pwd_context.verify(password_data.current_password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password incorrect"
        )
        
    hashed_password = pwd_context.hash(password_data.new_password)
    await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password": hashed_password}}
    )
    return {"status": "success", "message": "Password updated successfully"}