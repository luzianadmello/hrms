from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from config import settings
from models.user import User

from schemas.auth import (
    LoginRequest,
    LoginResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
)

from services.auth_service import (
    login_user,
    change_password,
    refresh_session,
    logout_user,
)

from utils.cookies import set_auth_cookies, clear_auth_cookies
from utils.dependencies import (
    get_current_user,
    get_db,
    get_role_name,
)

from utils.rbac import get_permission_names


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


def _send_tokens(response: Response, result: dict) -> dict:
    """Move both tokens into HttpOnly cookies; the JSON body never contains them."""
    set_auth_cookies(
        response,
        result.pop("access_token"),
        result.pop("refresh_token"),
    )
    return result


@router.post("/login", response_model=LoginResponse)
def login(
    user_data: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"

    return _send_tokens(
        response,
        login_user(db, user_data, client_ip),
    )


@router.post("/refresh", response_model=LoginResponse)
def refresh(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str | None = Cookie(
        default=None,
        alias=settings.refresh_cookie_name,
    ),
):
    return _send_tokens(
        response,
        refresh_session(db, refresh_token),
    )


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
        "has_employee_profile": current_user.employee_id is not None,
        "permissions": get_permission_names(db, current_user.role_id),
    }


@router.post("/change-password", response_model=ChangePasswordResponse)
def change_user_password(
    password_data: ChangePasswordRequest,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _send_tokens(
        response,
        change_password(db, current_user, password_data),
    )


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str | None = Cookie(
        default=None,
        alias=settings.refresh_cookie_name,
    ),
):
    result = logout_user(db, refresh_token)
    clear_auth_cookies(response)
    return result