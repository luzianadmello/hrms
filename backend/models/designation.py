from sqlalchemy import Column, Integer, String

from database import Base


class Designation(Base):
    __tablename__ = "designations"

    designation_id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    designation_name = Column(
        String,
        unique=True,
        nullable=False
    )