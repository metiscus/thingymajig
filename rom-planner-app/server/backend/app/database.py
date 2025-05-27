# backend/app/database.py
from sqlmodel import create_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from app.config import DATABASE_URL

# Convert DATABASE_URL to async format if needed
# If your DATABASE_URL is postgresql://... change it to postgresql+asyncpg://...
async_database_url = DATABASE_URL
if DATABASE_URL.startswith("postgresql://"):
    async_database_url = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Create async engine
async_engine = create_async_engine(async_database_url, echo=True)

# Create sync engine for table creation and other sync operations
sync_engine = create_engine(DATABASE_URL, echo=True)

# Async dependency to get a database session
async def get_async_session():
    async with AsyncSession(async_engine) as session:
        yield session

# Keep the sync session for backward compatibility and table creation
def get_session():
    from sqlmodel import Session
    with Session(sync_engine) as session:
        yield session