from sqlalchemy import Column, Integer, String

from database import Base


class Address(Base):
    __tablename__ = "addresses"

    address_id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    address_line1 = Column(
        String,
        nullable=False
    )

    address_line2 = Column(
        String,
        nullable=True
    )

    city = Column(
        String,
        nullable=False
    )

    state = Column(
        String,
        nullable=False
    )

    country = Column(
        String,
        nullable=False
    )

    pincode = Column(
        String,
        nullable=False
    )