from sqlalchemy.orm import Session

from database import engine
from models.role import Role


def seed_roles():
    db = Session(bind=engine)

    roles = ["ADMIN", "HR", "EMPLOYEE" , "MANAGER"]

    try:
        for role_name in roles:
            existing_role = db.query(Role).filter(
                Role.name == role_name
            ).first()

            if not existing_role:
                db.add(Role(name=role_name))

        db.commit()

        print("Roles seeded successfully!")

    finally:
        db.close()


if __name__ == "__main__":
    seed_roles()