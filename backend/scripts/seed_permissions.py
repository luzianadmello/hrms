from sqlalchemy.orm import Session

from database import engine
from models.permission import Permission


permissions = [
    {
        "permission_name": "user.login",
        "module": "Authentication",
        "action": "LOGIN",
        "description": "Allows a user to log into the HRMS",
    },
    {
        "permission_name": "user.logout",
        "module": "Authentication",
        "action": "LOGOUT",
        "description": "Allows a user to log out of the HRMS",
    },
    {
        "permission_name": "user.change_password",
        "module": "Authentication",
        "action": "CHANGE_PASSWORD",
        "description": "Allows a user to change their own password",
    },
    {
        "permission_name": "user.reset_password",
        "module": "Authentication",
        "action": "RESET_PASSWORD",
        "description": "Allows an authorized user to reset another user's password",
    },
    {
        "permission_name": "user.view",
        "module": "User Management",
        "action": "VIEW",
        "description": "Allows viewing user account details",
    },
    {
        "permission_name": "user.create",
        "module": "User Management",
        "action": "CREATE",
        "description": "Allows creating a user account",
    },
    {
        "permission_name": "user.update",
        "module": "User Management",
        "action": "UPDATE",
        "description": "Allows updating user account details",
    },
    {
        "permission_name": "user.activate",
        "module": "User Management",
        "action": "ACTIVATE",
        "description": "Allows activating a user account",
    },
    {
        "permission_name": "user.deactivate",
        "module": "User Management",
        "action": "DEACTIVATE",
        "description": "Allows deactivating a user account",
    },
    {
        "permission_name": "user.assign_role",
        "module": "User Management",
        "action": "ASSIGN_ROLE",
        "description": "Allows assigning a role to a user",
    },
]


def seed_permissions():
    db = Session(bind=engine)

    try:
        for permission_data in permissions:

            existing_permission = (
                db.query(Permission)
                .filter(
                    Permission.permission_name
                    == permission_data["permission_name"]
                )
                .first()
            )

            if existing_permission:
                print(
                    f"Permission already exists: "
                    f"{permission_data['permission_name']}"
                )
                continue

            permission = Permission(**permission_data)

            db.add(permission)

        db.commit()

        print("Permissions seeded successfully.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_permissions()