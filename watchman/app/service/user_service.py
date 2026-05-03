from passlib.context import CryptContext
from ..database import db
from ..models.user import UserCreate

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
users_collection = db.get_collection("users")

async def create_new_user(user_data: UserCreate):
    # Hash the password for security
    hashed_password = pwd_context.hash(user_data.password)
    
    user_dict = user_data.model_dump()
    user_dict["password"] = hashed_password
    
    # Insert into MongoDB
    result = await users_collection.insert_one(user_dict)
    
    # Return the created user info (excluding password)
    return {
        "id": str(result.inserted_id),
        **user_dict
    }