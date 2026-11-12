import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from config import settings
from database import engine
from routes import (
    attendance,
    auth,
    employee,
    organization,
    holidays,
    leave_types,
    leave_balances,
    leave_requests,
)

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

logger = logging.getLogger(__name__)


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(request: Request, exc: SQLAlchemyError):
    """Return a readable JSON error for database failures."""
    logger.exception("Database error on %s %s", request.method, request.url.path)

    detail = "Database error. Check the backend logs."

    if is_dev:
        detail += f" ({type(exc).__name__}: {getattr(exc, 'orig', exc)})"
        detail += " If this mentions a missing column or table, run `alembic upgrade head`."

    return JSONResponse(status_code=500, content={"detail": detail})


# API Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(employee.router, prefix="/api/v1")
app.include_router(organization.router, prefix="/api/v1")
app.include_router(attendance.router, prefix="/api/v1")
app.include_router(holidays.router, prefix="/api/v1")
app.include_router(leave_types.router, prefix="/api/v1")
app.include_router(leave_balances.router, prefix="/api/v1")
app.include_router(leave_requests.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "HRMS Backend is running"}


# Debug endpoint: development only
if settings.environment == "development":

    @app.get("/test-db")
    def test_db():
        try:
            with engine.connect():
                return {"message": "Database connected successfully!"}
        except Exception:
            return {"error": "Database connection failed. Check the server logs."}
