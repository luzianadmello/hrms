from getpass import getpass

from sqlalchemy.orm import Session

from database import engine
from models.user import User
from models.role import Role
from utils.security import hash_password


def create_admin():
    db = Session(bind=engine)

    try:
        # Check whether an Admin already exists
        admin_role = db.query(Role).filter(
            Role.name == "ADMIN"
        ).first()

        if not admin_role:
            print("ADMIN role does not exist.")
            return

        existing_admin = db.query(User).filter(
            User.role_id == admin_role.id
        ).first()

        if existing_admin:
            print("An Admin account already exists.")
            print(f"Admin email: {existing_admin.email}")
            return

        email = input("Admin email: ").strip()
        password = getpass("Admin password: ")
        confirm_password = getpass("Confirm password: ")

        if password != confirm_password:
            print("Passwords do not match.")
            return

        existing_user = db.query(User).filter(
            User.email == email
        ).first()

        if existing_user:
            print("A user with this email already exists.")
            return

        new_admin = User(
            email=email,
            password_hash=hash_password(password),
            role_id=admin_role.id,
            is_active=True
        )

        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)

        print("Admin created successfully!")
        print(f"Admin ID: {new_admin.user_id}")
        print(f"Admin email: {new_admin.email}")

    finally:
        db.close()


if __name__ == "__main__":
    create_admin()