from sqlalchemy import Column, Integer, ForeignKey

from database import Base


class RoleCreationRule(Base):
    __tablename__ = "role_creation_rules"

    creator_role_id = Column(
        Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    target_role_id = Column(
        Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )