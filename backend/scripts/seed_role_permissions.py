from sqlalchemy.orm import Session

from database import engine
from models.role import Role
from models.permission import Permission
from models.role_permission import RolePermission


ROLE_PERMISSIONS = {
    "ADMIN": [
        "user.login",
        "user.logout",
        "user.change_password",
        "user.reset_password",
        "user.view",
        "user.create",
        "user.update",
        "user.activate",
        "user.deactivate",
        "user.assign_role",
    ],

    "HR": [
        "user.login",
        "user.logout",
        "user.change_password",
        "user.reset_password",
        "user.view",
        "user.create",
        "user.update",
        "user.activate",
        "user.deactivate",
    ],

    "EMPLOYEE": [
        "user.login",
        "user.logout",
        "user.change_password",
    ],

    "MANAGER": [
        "user.login",
        "user.logout",
        "user.change_password",
    ],
}


def seed_role_permissions():
    db = Session(bind=engine)

    try:
        for role_name, permission_names in ROLE_PERMISSIONS.items():

            role = (
                db.query(Role)
                .filter(Role.name == role_name)
                .first()
            )

            if not role:
                print(f"Role not found: {role_name}")
                continue

            for permission_name in permission_names:

                permission = (
                    db.query(Permission)
                    .filter(
                        Permission.permission_name == permission_name
                    )
                    .first()
                )

                if not permission:
                    print(
                        f"Permission not found: {permission_name}"
                    )
                    continue

                existing_mapping = (
                    db.query(RolePermission)
                    .filter(
                        RolePermission.role_id == role.id,
                        RolePermission.permission_id
                        == permission.permission_id
                    )
                    .first()
                )

                if existing_mapping:
                    continue

                mapping = RolePermission(
                    role_id=role.id,
                    permission_id=permission.permission_id
                )

                db.add(mapping)

        db.commit()

        print("Role-permission mappings seeded successfully.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_role_permissions()