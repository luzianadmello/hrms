import secrets
import string
import uuid

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.department import Department
from models.designation import Designation
from models.employee import Employee
from models.user import User
from schemas.user import CreateEmployeeRequest
from utils.security import hash_password


ROLE_ADMIN, ROLE_HR, ROLE_EMPLOYEE, ROLE_MANAGER = 1, 2, 3, 4

# Who may create whom. Admin is never a target.
CAN_CREATE = {
    ROLE_ADMIN: {ROLE_HR, ROLE_EMPLOYEE, ROLE_MANAGER},
    ROLE_HR: {ROLE_EMPLOYEE, ROLE_MANAGER},
}


def generate_temporary_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(chars) for _ in range(length))


def create_employee(
    db: Session,
    data: CreateEmployeeRequest,
    current_user: User
):
    # 1. Role rule
    if data.role_id not in CAN_CREATE.get(current_user.role_id, set()):
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to create this role"
        )

    email = data.email.lower()

    # 2. Duplicate email check
    if (
        db.query(User).filter(User.email == email).first()
        or db.query(Employee).filter(Employee.email == email).first()
    ):
        raise HTTPException(
            status_code=409,
            detail="Email is already registered"
        )

    # 3. Foreign key validation
    if not db.get(Department, data.department_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid department"
        )

    if not db.get(Designation, data.designation_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid designation"
        )

    if data.manager_id is not None and not db.get(
        Employee,
        data.manager_id
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid manager"
        )

    # Generate temporary password
    temp_password = generate_temporary_password()

    # 4. Create Employee + User in one transaction
    try:
        employee = Employee(
            employee_code=f"TMP-{uuid.uuid4().hex}",
            first_name=data.first_name.strip(),
            last_name=data.last_name.strip(),
            email=email,
            date_of_joining=data.date_of_joining,
            employment_type=data.employment_type.value,
            status="ONBOARDING",
            department_id=data.department_id,
            designation_id=data.designation_id,
            manager_id=data.manager_id,
        )

        db.add(employee)
        db.flush()

        # Generate employee code after employee_id is available
        employee.employee_code = (
            f"EMP{employee.employee_id - 100:03d}"
        )

        user = User(
            role_id=data.role_id,
            employee_id=employee.employee_id,
            email=email,
            password_hash=hash_password(temp_password),
            is_active=True,
            must_change_password=True,
        )

        db.add(user)

        db.commit()

        db.refresh(employee)
        db.refresh(user)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Employee or email already exists"
        )

    # 5. Return temporary password for development/testing
    return {
        "message": "Employee created successfully",
        "employee_id": employee.employee_id,
        "employee_code": employee.employee_code,
        "user_id": user.user_id,
        "role_id": user.role_id,
        "email": email,
        "temporary_password": temp_password,
    }