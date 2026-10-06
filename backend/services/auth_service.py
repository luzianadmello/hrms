from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.user import User

from schemas.auth import (
    LoginRequest,
    ChangePasswordRequest
)


from utils.security import (
    verify_password,
    hash_password,
    create_access_token
)


def login_user(
    db: Session,
    user_data: LoginRequest
):
    user = db.query(User).filter(
        User.email == user_data.email
    ).first()

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

    user.last_login = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)

    access_token = create_access_token({
        "user_id": user.user_id,
        "email": user.email,
        "role_id": user.role_id
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": user.must_change_password
    }


def change_password(
    db: Session,
    user: User,
    password_data: ChangePasswordRequest
):
    db_user = db.query(User).filter(
        User.user_id == user.user_id
    ).first()

    if not db_user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if not verify_password(
        password_data.current_password,
        db_user.password_hash
    ):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect"
        )

    if password_data.new_password != password_data.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="New passwords do not match"
        )

    if password_data.current_password == password_data.new_password:
        raise HTTPException(
            status_code=400,
            detail="New password must be different from current password"
        )

    db_user.password_hash = hash_password(
        password_data.new_password
    )

    db_user.must_change_password = False

    db.commit()

    return {
        "message": "Password changed successfully"
    }