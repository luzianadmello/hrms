
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
from utils.rbac import creatable_role_ids, manager_employee_query


def generate_temporary_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(chars) for _ in range(length))


def create_employee(
    db: Session,
    data: CreateEmployeeRequest,
    current_user: User
):
    # 1. Role rule
    if data.role_id not in creatable_role_ids(db, current_user.role_id):
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to create this role",
        )

    email = data.email.lower()

    # 2. Duplicate email check
    if (
        db.query(User).filter(User.email == email).first()
        or db.query(Employee).filter(Employee.email == email).first()
    ):
        raise HTTPException(
            status_code=409,
            detail="Email is already registered",
        )

    # 3. Foreign key validation
    if not db.get(Department, data.department_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid department",
        )

    if not db.get(Designation, data.designation_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid designation",
        )

    if data.manager_id is not None and not (
        manager_employee_query(db)
        .filter(Employee.employee_id == data.manager_id)
        .first()
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid manager",
        )

    # No password is created or sent here. The employee is Inactive until HR
    # clicks Activate; until then the account holds a random password
    # nobody knows and cannot log in.
    unusable_password = secrets.token_urlsafe(32)

    # 4. Create Employee + User in one transaction
    try:
        employee = Employee(
            employee_code=f"TMP-{uuid.uuid4().hex}",
            first_name=data.first_name.strip(),
            last_name=data.last_name.strip(),
            email=email,
            dob=data.dob,
            date_of_joining=data.date_of_joining,
            employment_type=data.employment_type.value,
            status="INACTIVE",
            department_id=data.department_id,
            designation_id=data.designation_id,
            manager_id=data.manager_id,
        )

        db.add(employee)
        db.flush()

        # Generate employee code after employee_id is available
        employee.employee_code = f"EMP{employee.employee_id:04d}"

        user = User(
            role_id=data.role_id,
            employee_id=employee.employee_id,
            email=email,
            password_hash=hash_password(unusable_password),
            is_active=False,
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
            detail="Employee or email already exists",
        )

    return {
        "message": "Employee created as Inactive. Activate them when they should receive their login details.",
        "employee_id": employee.employee_id,
        "employee_code": employee.employee_code,
        "user_id": user.user_id,
        "role_id": user.role_id,
        "email": email,
        "status": employee.status,
    }
