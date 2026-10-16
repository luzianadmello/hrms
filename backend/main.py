import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import engine
from routes import auth, employee


# Show the audit lines (who changed what) in the console
logging.basicConfig(level=logging.INFO)

# The interactive docs list every endpoint: development only
is_dev = settings.environment == "development"

app = FastAPI(
    title="HRMS API",
    docs_url="/docs" if is_dev else None,
    redoc_url=None,
    openapi_url="/openapi.json" if is_dev else None,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router, prefix="/api/v1")
app.include_router(employee.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "HRMS Backend is running"}


# Debug endpoint: only exists in development, and never leaks the raw error
# (connection errors can contain your DB host and credentials).
if settings.environment == "development":

    @app.get("/test-db")
    def test_db():
        try:
            with engine.connect():
                return {"message": "Database connected successfully!"}
        except Exception:
            return {"error": "Database connection failed. Check the server logs."}