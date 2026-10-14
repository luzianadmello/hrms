from sqlalchemy.orm import Session

from database import engine
from models.role import Role
from models.role_creation_rule import RoleCreationRule

RULES = {
    "ADMIN": ["HR", "MANAGER", "EMPLOYEE"],
    "HR": ["MANAGER", "EMPLOYEE"],
}


def seed():
    db = Session(bind=engine)
    try:
        ids = {r.name: r.id for r in db.query(Role).all()}
        for creator, targets in RULES.items():
            for target in targets:
                exists = (
                    db.query(RoleCreationRule)
                    .filter_by(
                        creator_role_id=ids[creator],
                        target_role_id=ids[target],
                    )
                    .first()
                )
                if not exists:
                    db.add(
                        RoleCreationRule(
                            creator_role_id=ids[creator],
                            target_role_id=ids[target],
                        )
                    )
        db.commit()
        print("Role creation rules seeded.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()