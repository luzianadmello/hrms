from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from config import settings
from models.refresh_token import RefreshToken
from models.user import User
from schemas.auth import LoginRequest, ChangePasswordRequest
from utils.login_throttle import check_not_locked, record_failure, clear
from utils.security import (
    verify_password,
    hash_password,
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
)

# Checked when the email doesn't exist, so response time doesn't reveal it
_DUMMY_HASH = hash_password("dummy-password-for-timing-only")


def _access_token_for(user: User, session_id: int) -> str:
    # "sid" ties the token to its session row: delete the row (logout, HR
    # reset, deactivation) and the access token dies immediately.
    return create_access_token({
        "user_id": user.user_id,
        "email": user.email,
        "role_id": user.role_id,
        "sid": session_id,
    })


def _new_session(db: Session, user: User) -> tuple[RefreshToken, str]:
    """Create a session. Only the hash is stored; the raw value goes to the cookie."""
    raw = generate_refresh_token()
    row = RefreshToken(
        user_id=user.user_id,
        token_hash=hash_refresh_token(raw),
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, raw


def revoke_user_sessions(db: Session, user_id: int) -> None:
    """End every session of a user. Does not commit: the caller's commit applies it."""
    db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete(
        synchronize_session=False
    )


def _purge_expired(db: Session) -> None:
    db.query(RefreshToken).filter(
        RefreshToken.expires_at < datetime.now(timezone.utc)
    ).delete(synchronize_session=False)


def login_user(db: Session, user_data: LoginRequest, client_ip: str = "unknown"):
    email = user_data.email.strip().lower()
    key = f"{email}|{client_ip}"

    check_not_locked(key)

    user = db.query(User).filter(User.email == email).first()

    password_ok = verify_password(
        user_data.password,
        user.password_hash if user else _DUMMY_HASH,
    )

    # Password first, so we never reveal that an account exists or is disabled
    if not user or not password_ok:
        record_failure(key)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")

    clear(key)

    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    _purge_expired(db)
    session, raw = _new_session(db, user)

    return {
        "access_token": _access_token_for(user, session.id),
        "refresh_token": raw,
        "must_change_password": user.must_change_password,
        "profile_completed": user.profile_completed,
        "role_id": user.role_id,
    }


def change_password(db: Session, user: User, password_data: ChangePasswordRequest):
    db_user = db.query(User).filter(User.user_id == user.user_id).first()

    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Passwords are HR-managed. A user may only set a new password when the
    # account was just created or HR reset it (must_change_password is true).
    if not db_user.must_change_password:
        raise HTTPException(
            status_code=403,
            detail="Password changes are handled by HR. Please contact HR to reset your password.",
        )

    if password_data.new_password != password_data.confirm_password:
        raise HTTPException(status_code=400, detail="New passwords do not match")

    if len(password_data.new_password) < 10:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 10 characters long",
        )

    if verify_password(password_data.new_password, db_user.password_hash):
        raise HTTPException(
            status_code=400,
            detail="New password must be different from the temporary password",
        )

    db_user.password_hash = hash_password(password_data.new_password)
    db_user.must_change_password = False

    # Log out every session (including this one), then start a fresh one
    revoke_user_sessions(db, db_user.user_id)
    db.commit()
    db.refresh(db_user)

    session, raw = _new_session(db, db_user)

    return {
        "message": "Password changed successfully",
        "access_token": _access_token_for(db_user, session.id),
        "refresh_token": raw,
        "role_id": db_user.role_id,
        "profile_completed": db_user.profile_completed,
    }


def refresh_session(db: Session, refresh_token: str | None):
    """Rotate the refresh token in place. The session id (sid) stays the same."""
    invalid = HTTPException(status_code=401, detail="Session expired. Please log in again.")

    if not refresh_token:
        raise invalid

    row = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == hash_refresh_token(refresh_token))
        .first()
    )
    if not row:
        raise invalid

    if row.expires_at < datetime.now(timezone.utc):
        db.delete(row)
        db.commit()
        raise invalid

    user = db.query(User).filter(User.user_id == row.user_id).first()
    if not user or not user.is_active:
        revoke_user_sessions(db, row.user_id)
        db.commit()
        raise invalid

    raw = generate_refresh_token()
    row.token_hash = hash_refresh_token(raw)
    row.expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days
    )
    db.commit()

    return {
        "access_token": _access_token_for(user, row.id),
        "refresh_token": raw,
        "must_change_password": user.must_change_password,
        "profile_completed": user.profile_completed,
        "role_id": user.role_id,
    }


def logout_user(db: Session, refresh_token: str | None):
    """Ends this browser's session only. Works even if the access token has expired."""
    if refresh_token:
        db.query(RefreshToken).filter(
            RefreshToken.token_hash == hash_refresh_token(refresh_token)
        ).delete(synchronize_session=False)
        db.commit()
    return {"message": "Logged out successfully"}