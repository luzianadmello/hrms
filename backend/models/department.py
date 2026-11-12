from sqlalchemy import Column, Integer, String
from database import Base


class Department(Base):
    __tablename__ = "departments"

    department_id = Column(Integer, primary_key=True, index=True)
    department_name = Column(String, unique=True, nullable=False)
    status = Column(String(10), nullable=False, default="ACTIVE", server_default="ACTIVE")
