from sqlalchemy import Column, Integer, String, Date, Text, DateTime, func
from database import Base


class Holiday(Base):
    __tablename__ = "holidays"

    holiday_id = Column(Integer, primary_key=True, index=True)
    holiday_name = Column(String(100), nullable=False)
    holiday_date = Column(Date, nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )