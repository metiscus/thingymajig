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

# Authentication secret key
AUTH_SECRET_KEY = os.getenv("AUTH_SECRET_KEY")
if not AUTH_SECRET_KEY:
    raise ValueError("AUTH_SECRET_KEY environment variable not set. This is required for JWT.")

# --- NEW: RFI Storage Path ---
RFI_STORAGE_BASE_PATH_STR = os.getenv("RFI_STORAGE_BASE_PATH", "/app/media/rfi_uploads")
# Ensure it's an absolute path for consistency, though relative might work inside container if CWD is /app
if not os.path.isabs(RFI_STORAGE_BASE_PATH_STR):
    # Assuming CWD is /app if running in container, adjust if necessary for local dev
    RFI_STORAGE_BASE_PATH_STR = os.path.join(os.getcwd(), RFI_STORAGE_BASE_PATH_STR)
    print(f"Warning: RFI_STORAGE_BASE_PATH was relative, resolved to: {RFI_STORAGE_BASE_PATH_STR}")

RFI_STORAGE_BASE_PATH = RFI_STORAGE_BASE_PATH_STR
# It might be better to use pathlib.Path for RFI_STORAGE_BASE_PATH later in the router.
# For now, keeping it as a string in config.