# backend/app/auth.py
from typing import AsyncGenerator, Optional
import uuid

from fastapi import Depends, Request
from fastapi_users_db_sqlmodel import SQLModelUserDatabaseAsync
from fastapi_users import BaseUserManager, FastAPIUsers
from fastapi_users.authentication import JWTStrategy, AuthenticationBackend, BearerTransport
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_async_session
from app.models import User
from app.config import AUTH_SECRET_KEY

# 1. User Manager - FIXED: Added parse_id method for UUID handling
class UserManager(BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = AUTH_SECRET_KEY
    verification_token_secret = AUTH_SECRET_KEY

    def parse_id(self, value) -> uuid.UUID:
        """Parse string ID to UUID - required for UUID primary keys"""
        try:
            return uuid.UUID(value)
        except ValueError:
            raise ValueError(f"Invalid UUID format: {value}")

    # Optional: Customize user lifecycle events
    async def on_after_register(self, user: User, request: Optional[Request] = None):
        print(f"User {user.id} has registered.")

    async def on_after_forgot_password(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        print(f"User {user.id} has forgot their password. Reset token: {token}")

    async def on_after_request_verify(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        print(f"Verification requested for user {user.id}. Verification token: {token}")

# 2. Database Adapter for Users
async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    yield SQLModelUserDatabaseAsync(session, User)

# 3. Authentication Backend (JWT Strategy)
def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=AUTH_SECRET_KEY, lifetime_seconds=3600)

# Bearer transport for JWT tokens
bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")

auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

# 4. FastAPIUsers instance
async def get_user_manager(user_db: SQLModelUserDatabaseAsync = Depends(get_user_db)):
    yield UserManager(user_db)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

# 5. Dependencies for current authenticated user
current_active_user = fastapi_users.current_user(active=True)
current_superuser = fastapi_users.current_user(active=True, superuser=True)