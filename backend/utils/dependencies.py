
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyCookie

from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config import settings
from database import get_db

from models.user import User
from models.role import Role
from models.role_permission import RolePermission
from models.permission import Permission
from models.refresh_token import RefreshToken


cookie_scheme = APIKeyCookie(
    name=settings.access_cookie_name,
    auto_error=False,
)


def get_current_user(
    access_token: str | None = Depends(cookie_scheme),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    if not access_token:
        raise credentials_exception

    try:
        payload = jwt.decode(
            access_token,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
    except JWTError:
        raise credentials_exception

    if payload.get("type") != "access":
        raise credentials_exception

    user_id = payload.get("user_id")
    if user_id is None:
        raise credentials_exception

    user = db.query(User).filter(User.user_id == user_id).first()

    if user is None or not user.is_active:
        raise credentials_exception

    sid = payload.get("sid")
    if sid is None:
        raise credentials_exception

    session = db.get(RefreshToken, sid)
    if session is None or session.user_id != user.user_id:
        raise credentials_exception

    return user


def get_ready_user(current_user: User = Depends(get_current_user)):
    if current_user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change required",
        )

    return current_user


def has_permission(db: Session, user: User, permission: str) -> bool:
    return (
        db.query(Permission)
        .join(
            RolePermission,
            RolePermission.permission_id == Permission.permission_id,
        )
        .filter(
            RolePermission.role_id == user.role_id,
            Permission.permission_name == permission,
        )
        .first()
        is not None
    )


def ensure_permission(db: Session, user: User, permission: str) -> None:
    if not has_permission(db, user, permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied",
        )


def require_permission(permission: str):
    def permission_checker(
        current_user: User = Depends(get_ready_user),
        db: Session = Depends(get_db),
    ):
        ensure_permission(db, current_user, permission)
        return current_user

    return permission_checker


def get_role_name(db: Session, user: User) -> str | None:
    role = db.get(Role, user.role_id)
    return role.name if role else None


def require_any_permission(*permissions: str):
    """Authorize when the user has at least one database-backed permission."""
    def permission_checker(
        current_user: User = Depends(get_ready_user),
        db: Session = Depends(get_db),
    ):
        if not any(has_permission(db, current_user, permission) for permission in permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied",
            )
        return current_user
    return permission_checker


def employee_view_scope(db: Session, user: User, allow_self: bool = False) -> str:
    """Resolve authorized employee data scope from role_permissions."""
    if has_permission(db, user, "employee.view_all"):
        return "all"
    if has_permission(db, user, "employee.view_team"):
        return "team"
    if allow_self and user.employee_id is not None:
        return "self"
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Permission denied",
    )


def require_employee_view_scope(
    current_user: User = Depends(get_ready_user),
    db: Session = Depends(get_db),
) -> str:
    return employee_view_scope(db, current_user)


def require_employee_stats_scope(
    current_user: User = Depends(get_ready_user),
    db: Session = Depends(get_db),
) -> str:
    # Organization-wide employee statistics are currently restricted to roles
    # explicitly granted employee.view_stats (ADMIN and HR in the seed mapping).
    # Team statistics are deferred until the manager analytics feature is implemented.
    if has_permission(db, current_user, "employee.view_stats"):
        return "all"
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Permission denied",
    )


def ensure_employee_target_access(
    db: Session,
    actor: User,
    employee_id: int,
    *,
    allow_peer_hr_edit: bool = False,
) -> None:
    """Central target-level authorization for employee management actions."""
    from models.employee import Employee
    from models.role import Role
    from models.role_creation_rule import RoleCreationRule
    from models.user import User as UserModel

    employee = db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    target = db.query(UserModel).filter(UserModel.employee_id == employee_id).first()
    if target is None:
        raise HTTPException(status_code=404, detail="User account not found for this employee")

    can_manage = (
        db.query(RoleCreationRule)
        .filter(
            RoleCreationRule.creator_role_id == actor.role_id,
            RoleCreationRule.target_role_id == target.role_id,
        )
        .first()
        is not None
    )
    if can_manage:
        return

    if allow_peer_hr_edit and has_permission(db, actor, "employee.update_hr"):
        target_role = db.get(Role, target.role_id)
        if target_role and target_role.name.strip().upper() == "HR":
            return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You are not allowed to manage this employee",
    )
