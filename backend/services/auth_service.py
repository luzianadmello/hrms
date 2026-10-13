from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.user import User

from schemas.auth import (
    LoginRequest,
    ChangePasswordRequest,
)

from utils.security import (
    verify_password,
    hash_password,
    create_access_token,
)


def login_user(
    db: Session,
    user_data: LoginRequest,
    client_ip: str = "unknown"
):
    user = (
        db.query(User)
        .filter(
            User.email == user_data.email
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is inactive"
        )

    if not verify_password(
        user_data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # Update last login
    user.last_login = datetime.now(
        timezone.utc
    )

    db.commit()
    db.refresh(user)

    # Create JWT
    access_token = create_access_token({
        "user_id": user.user_id,
        "email": user.email,
        "role_id": user.role_id,
        "tv": user.token_version,
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": user.must_change_password,
        "profile_completed": user.profile_completed,
        "role_id": user.role_id,
    }


def change_password(
    db: Session,
    user: User,
    password_data: ChangePasswordRequest
):
    db_user = (
        db.query(User)
        .filter(
            User.user_id == user.user_id
        )
        .first()
    )

    if not db_user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # Confirm passwords match
    if (
        password_data.new_password
        != password_data.confirm_password
    ):
        raise HTTPException(
            status_code=400,
            detail="New passwords do not match"
        )

    # Minimum password length
    if len(password_data.new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail=(
                "Password must be at least "
                "8 characters long"
            )
        )

    # Update password
    db_user.password_hash = hash_password(
        password_data.new_password
    )

    # First-login requirement completed
    db_user.must_change_password = False

    # Invalidate previously issued tokens
    db_user.token_version = (
        db_user.token_version or 0
    ) + 1

    db.commit()
    db.refresh(db_user)

    # Create fresh token after password change
    access_token = create_access_token({
        "user_id": db_user.user_id,
        "email": db_user.email,
        "role_id": db_user.role_id,
        "tv": db_user.token_version,
    })

    return {
        "message": "Password changed successfully",
        "access_token": access_token,
        "token_type": "bearer",
        "role_id": db_user.role_id,
        "profile_completed": db_user.profile_completed,
    }


def logout_user(
    db: Session,
    user: User
):
    # Invalidate the current token
    user.token_version = (
        user.token_version or 0
    ) + 1

    db.commit()

    return {
        "message": "Logged out successfully"
    }
