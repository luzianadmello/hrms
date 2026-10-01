from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey

from database import Base


class Employee(Base):
    __tablename__ = "employees"

    employee_id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    employee_code = Column(
        String,
        unique=True,
        nullable=False
    )

    first_name = Column(
        String,
        nullable=True
    )

    last_name = Column(
        String,
        nullable=True
    )

    email = Column(
        String,
        unique=True,
        nullable=False
    )

    phone = Column(
        String,
        nullable=True
    )

    dob = Column(
        Date,
        nullable=True
    )

    date_of_joining = Column(
        Date,
        nullable=False
    )

    employment_type = Column(
        String,
        nullable=False
    )

    status = Column(
        String,
        nullable=False
    )

    department_id = Column(
        Integer,
        ForeignKey("departments.department_id"),
        nullable=True
    )

    designation_id = Column(
        Integer,
        ForeignKey("designations.designation_id"),
        nullable=True
    )

    residential_address_id = Column(
        Integer,
        ForeignKey("addresses.address_id"),
        nullable=True
    )

    manager_id = Column(
        Integer,
        ForeignKey("employees.employee_id"),
        nullable=True
    )

    personal_email = Column(String, nullable=True)

    profile_completed_at = Column(DateTime, nullable=True)

    created_by = Column(
        Integer,
        ForeignKey("employees.employee_id"),
        nullable=True
    )