from sqlalchemy.orm import Session

from models.employee import Employee
from models.permission import Permission
from models.role_permission import RolePermission
from models.role_creation_rule import RoleCreationRule
from models.user import User


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


def can_manage_role(db: Session, actor_role_id: int, target_role_id: int) -> bool:
    """An actor manages a person only if they could have created that role.

    So HR can manage Managers and Employees but not other HR; Admin can
    manage everyone below Admin.
    """
    return target_role_id in creatable_role_ids(db, actor_role_id)


def manager_employee_query(db: Session):
    """Employees who can be a reporting manager.

    Decided by the employee.view_team permission in the database, not by a
    role name. Only Active people can be picked.
    """
    return (
        db.query(Employee)
        .join(User, User.employee_id == Employee.employee_id)
        .join(RolePermission, RolePermission.role_id == User.role_id)
        .join(
            Permission,
            Permission.permission_id == RolePermission.permission_id,
        )
        .filter(
            Permission.permission_name == "employee.view_team",
            Employee.status == "ACTIVE",
        )
    )