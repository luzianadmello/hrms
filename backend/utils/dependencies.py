from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config import settings
from database import get_db

from models.user import User
from models.role_permission import RolePermission
from models.permission import Permission


bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm]
        )

        user_id = payload.get("user_id")

        if user_id is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(
        User.user_id == user_id
    ).first()

    if user is None:
        raise credentials_exception

    return user


def get_ready_user(
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    if current_user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change required"
        )

    return current_user


def require_permission(permission: str):
    def permission_checker(
        current_user: User = Depends(get_ready_user),
        db: Session = Depends(get_db)
    ):
        has_permission = (
            db.query(Permission)
            .join(
                RolePermission,
                RolePermission.permission_id == Permission.permission_id
            )
            .filter(
                RolePermission.role_id == current_user.role_id,
                Permission.permission_name == permission
            )
            .first()
        )

        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied"
            )

        return current_user

    return permission_checker