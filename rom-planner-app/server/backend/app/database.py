# backend/app/database.py
from sqlmodel import create_engine, Session
from app.config import DATABASE_URL

# Create the engine, echo=True logs SQL statements (useful for debugging)
engine = create_engine(DATABASE_URL, echo=True)

# Dependency to get a database session
def get_session():
    with Session(engine) as session:
        yield session