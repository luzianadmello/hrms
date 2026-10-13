from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from models.user import User

from schemas.auth import (
    LoginRequest,
    TokenResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
)

from services.auth_service import (
    login_user,
    change_password,
    logout_user,
)

from utils.dependencies import (
    get_current_user,
    get_db,
    get_role_name,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post("/login", response_model=TokenResponse)
def login(
    user_data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"

    return login_user(db, user_data, client_ip)


@router.get("/me")
def get_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {
        "user_id": current_user.user_id,
        "email": current_user.email,
        "role_id": current_user.role_id,
        "role_name": get_role_name(db, current_user),
        "must_change_password": current_user.must_change_password,
        "profile_completed": current_user.profile_completed,
    }


@router.post("/change-password", response_model=ChangePasswordResponse)
def change_user_password(
    password_data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return change_password(db, current_user, password_data)


@router.post("/logout")
def logout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return logout_user(db, current_user)        