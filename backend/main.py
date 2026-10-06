from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine
from routes import auth, employee


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(
    auth.router,
    prefix="/api/v1"
)

app.include_router(
    employee.router,
    prefix="/api/v1"
)


@app.get("/")
def root():
    return {
        "message": "HRMS Backend is running"
    }


@app.get("/test-db")
def test_db():
    try:
        with engine.connect():
            return {
                "message": "Database connected successfully!"
            }

    except Exception as e:
        return {
            "error": str(e)
        }