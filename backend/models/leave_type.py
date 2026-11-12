from sqlalchemy import Boolean, Column, Integer, String, Text, text

from database import Base


class LeaveType(Base):
    __tablename__ = "leave_types"

    leave_type_id = Column(Integer, primary_key=True, index=True)
    leave_type_name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    is_paid = Column(Boolean, nullable=False, default=True, server_default=text("true"))
