# backend/app/schemas.py
from fastapi_users import schemas
import uuid
from typing import Optional

class UserRead(schemas.BaseUser[uuid.UUID]):
    pass

class UserCreate(schemas.BaseUserCreate):
    pass

class UserUpdate(schemas.BaseUserUpdate):
    pass