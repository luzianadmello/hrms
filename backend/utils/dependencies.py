from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from database import engine
from models.user import User
from models.permission import Permission
from models.role_permission import RolePermission
from utils.security import SECRET_KEY, ALGORITHM

security = HTTPBearer()


def get_db():
    db = Session(bind=engine)
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Valid token + active user. Does NOT check must_change_password."""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    user = db.query(User).filter(User.user_id == user_id).first()
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "User account is inactive")
    return user


def get_ready_user(user: User = Depends(get_current_user)):
    """Use on every route EXCEPT /auth/change-password and /auth/me."""
    if user.must_change_password:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "PASSWORD_CHANGE_REQUIRED")
    return user


def require_permission(permission_name: str):
    def checker(
        current_user: User = Depends(get_ready_user),
        db: Session = Depends(get_db),
    ):
        allowed = (
            db.query(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.permission_id)
            .filter(
                RolePermission.role_id == current_user.role_id,
                Permission.permission_name == permission_name,
            )
            .first()
        )
        if not allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Permission denied")
        return current_user

    return checker