# backend/app/config.py
import os
from dotenv import load_dotenv

# Load environment variables from .env file if running locally (e.g., for tests)
# In a container orchestrated by podman-compose, these are injected by podman-compose.yaml
load_dotenv()

# Database settings
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable not set. Please check .env.local or podman-compose.yaml.")

# CORS origins (e.g., "http://localhost:5173")
FRONTEND_CORS_ORIGINS = os.getenv("FRONTEND_CORS_ORIGINS", "http://localhost:5173").split(',')

APP_NAME = "ROM Planner API"