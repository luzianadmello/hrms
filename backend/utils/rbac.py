from sqlalchemy.orm import Session

from models.permission import Permission
from models.role_permission import RolePermission
from models.role_creation_rule import RoleCreationRule


def get_permission_names(db: Session, role_id: int) -> list[str]:
    rows = (
        db.query(Permission.permission_name)
        .join(
            RolePermission,
            RolePermission.permission_id == Permission.permission_id,
        )
        .filter(RolePermission.role_id == role_id)
        .order_by(Permission.permission_name)
        .all()
    )
    return [r[0] for r in rows]


def creatable_role_ids(db: Session, creator_role_id: int) -> set[int]:
    rows = (
        db.query(RoleCreationRule.target_role_id)
        .filter(RoleCreationRule.creator_role_id == creator_role_id)
        .all()
    )
    return {r[0] for r in rows}