from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import engine
from models.user import User

from schemas.auth import (
    LoginRequest,
    TokenResponse,
    ChangePasswordRequest
)

from services.auth_service import (
    login_user,
    change_password
)

from utils.dependencies import get_current_user

from sqlalchemy.orm import Session
from utils.dependencies import get_current_user, get_db


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)



# ----- LOGIN ROUTE ----- #

@router.post("/login", response_model=TokenResponse)
def login(
    user_data: LoginRequest,
    db: Session = Depends(get_db)
):
    return login_user(
        db,
        user_data
    )


# ----- CURRENT USER ROUTE ----- #

@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user)
):
    return {
        "user_id": current_user.user_id,
        "email": current_user.email
    }


# ----- CHANGE PASSWORD ROUTE ----- #

@router.post("/change-password")
def change_user_password(
    password_data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return change_password(
        db,
        current_user,
        password_data
    )