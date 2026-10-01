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
from utils.email import send_email
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


def create_employee(db: Session, data: CreateEmployeeRequest, current_user: User):
    # 1. Role rule (creator role comes from the DB user, never the body)
    if data.role_id not in CAN_CREATE.get(current_user.role_id, set()):
        raise HTTPException(403, "You are not allowed to create this role")

    email = data.email.lower()
    personal_email = data.personal_email.lower()
    if email == personal_email:
        raise HTTPException(400, "Personal email must differ from work email")

    # 2. Duplicates
    if db.query(User).filter(User.email == email).first() or \
       db.query(Employee).filter(Employee.email == email).first():
        raise HTTPException(409, "Email is already registered")

    # 3. Foreign keys exist
    if not db.get(Department, data.department_id):
        raise HTTPException(400, "Invalid department")
    if not db.get(Designation, data.designation_id):
        raise HTTPException(400, "Invalid designation")
    if data.manager_id is not None and not db.get(Employee, data.manager_id):
        raise HTTPException(400, "Invalid manager")

    temp_password = generate_temporary_password()

    # 4. Employee + User in one transaction
    try:
        employee = Employee(
            employee_code=f"TMP-{uuid.uuid4().hex}",   # replaced below
            first_name=data.first_name.strip(),
            last_name=data.last_name.strip(),
            email=email,
            personal_email=personal_email,
            date_of_joining=data.date_of_joining,
            employment_type=data.employment_type.value,
            status="ONBOARDING",
            department_id=data.department_id,
            designation_id=data.designation_id,
            manager_id=data.manager_id,
            created_by=current_user.employee_id,
        )
        db.add(employee)
        db.flush()  # gets employee_id

        # ids start at 101 -> EMP001. Race-free: derived from the unique id.
        employee.employee_code = f"EMP{employee.employee_id - 100:03d}"

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
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Employee or email already exists")

    # 5. Email credentials (never returned in the API response)
    sent = send_email(
        to=personal_email,
        subject="Your HRMS account",
        body=(
            f"Hi {data.first_name},\n\n"
            f"Your HRMS account is ready.\n"
            f"Login email: {email}\n"
            f"Temporary password: {temp_password}\n\n"
            f"You will be asked to change this password on first login.\n"
        ),
    )

    return {
        "message": "Employee created successfully",
        "employee_id": employee.employee_id,
        "employee_code": employee.employee_code,
        "user_id": user.user_id,
        "role_id": user.role_id,
        "email": email,
        "credentials_email_sent": sent,
    }