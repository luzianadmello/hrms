from sqlalchemy.orm import Session

from database import engine
from models.role import Role
from models.permission import Permission
from models.role_permission import RolePermission


ROLE_PERMISSIONS = {
    "ADMIN": [
        "user.login", "user.logout", "user.change_password", "user.reset_password",
        "user.view", "user.create", "user.update", "user.activate", "user.deactivate",
        "user.assign_role", "employee.view_all", "employee.update", "employee.view_stats",
        "employee.update_hr", "role.manage", "department.view", "department.create",
        "department.update", "department.deactivate", "designation.view",
        "designation.create", "designation.update", "designation.deactivate",
        "attendance.mark", "attendance.view_own", "attendance.view_all",
        "attendance.correct", "attendance.view_policy", "attendance.update_policy",
        "holiday.view", "holiday.manage", "leave_type.view", "leave_type.manage",
        "leave_balance.view_all", "leave_balance.view_own", "leave_balance.manage",
        "leave_request.view_all",
    ],
    "HR": [
        "user.login", "user.logout", "user.change_password", "user.reset_password",
        "user.view", "user.create", "user.update", "user.activate", "user.deactivate",
        "employee.view_all", "employee.update", "employee.view_stats", "employee.update_hr",
        "department.view", "department.create", "department.update", "department.deactivate",
        "designation.view", "designation.create", "designation.update", "designation.deactivate",
        "attendance.mark", "attendance.view_own", "attendance.view_all",
        "attendance.correct", "attendance.view_policy", "attendance.update_policy",
        "holiday.view", "holiday.manage", "leave_type.view", "leave_type.manage",
        "leave_balance.view_all", "leave_balance.view_own", "leave_balance.manage",
        "leave_request.view_all", "leave_request.view_own", "leave_request.review",
    ],
    "EMPLOYEE": [
        "user.login", "user.logout", "user.change_password", "holiday.view",
        "leave_type.view", "attendance.mark", "attendance.view_own",
        "leave_balance.view_own", "leave_request.view_own", "leave_request.apply",
        "leave_request.cancel",
    ],
    "MANAGER": [
        "user.login", "user.logout", "user.change_password", "employee.view_team",
        "attendance.mark", "attendance.view_own", "holiday.view", "leave_type.view",
        "leave_balance.view_own", "leave_request.view_own", "leave_request.apply",
        "leave_request.view_team", "leave_request.review", "leave_request.cancel",
    ],
}


def seed_role_permissions():
    db = Session(bind=engine)
    try:
        for role_name, permission_names in ROLE_PERMISSIONS.items():
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                print(f"Role not found: {role_name}")
                continue
            for permission_name in permission_names:
                permission = (
                    db.query(Permission)
                    .filter(Permission.permission_name == permission_name)
                    .first()
                )
                if not permission:
                    print(f"Permission not found: {permission_name}")
                    continue
                existing_mapping = (
                    db.query(RolePermission)
                    .filter(
                        RolePermission.role_id == role.id,
                        RolePermission.permission_id == permission.permission_id,
                    )
                    .first()
                )
                if existing_mapping:
                    continue
                db.add(RolePermission(
                    role_id=role.id,
                    permission_id=permission.permission_id,
                ))
                print(f"Mapped {role_name} -> {permission_name}")

        deferred_permission = (
            db.query(Permission)
            .filter(Permission.permission_name == "employee.view_team_stats")
            .first()
        )
        if deferred_permission:
            db.query(RolePermission).filter(
                RolePermission.permission_id == deferred_permission.permission_id
            ).delete(synchronize_session=False)
            db.delete(deferred_permission)

        retired_permission = (
            db.query(Permission)
            .filter(Permission.permission_name == "attendance.manage")
            .first()
        )
        if retired_permission:
            db.query(RolePermission).filter(
                RolePermission.permission_id == retired_permission.permission_id
            ).delete(synchronize_session=False)
            db.delete(retired_permission)

        db.commit()
        print("Role-permission mappings seeded successfully.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_role_permissions()
