from datetime import date

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.address import Address
from models.department import Department
from models.designation import Designation
from models.employee import Employee
from models.role import Role
from models.user import User

from schemas.employee import EmployeeProfileUpdate
from utils.roles import MANAGER, assignable_role_names, role_label
from config import settings
from services.user_service import generate_temporary_password
from utils.email import send_email
from utils.security import hash_password


ADDRESS_KEYS = [
    "address_line1",
    "address_line2",
    "city",
    "state",
    "country",
    "pincode",
]

ADDRESS_REQUIRED = [
    "address_line1",
    "city",
    "state",
    "country",
    "pincode",
]


def _full_name(employee: Employee) -> str:
    return f"{employee.first_name or ''} {employee.last_name or ''}".strip()


def _get_employee(db: Session, user: User) -> Employee:
    employee = (
        db.query(Employee)
        .filter(Employee.employee_id == user.employee_id)
        .first()
    )

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee profile not found"
        )

    return employee


def get_employee_profile(db: Session, user: User):
    employee = _get_employee(db, user)

    role = db.get(Role, user.role_id)

    department = (
        db.get(Department, employee.department_id)
        if employee.department_id
        else None
    )

    designation = (
        db.get(Designation, employee.designation_id)
        if employee.designation_id
        else None
    )

    manager = (
        db.get(Employee, employee.manager_id)
        if employee.manager_id
        else None
    )

    address = (
        db.get(Address, employee.residential_address_id)
        if employee.residential_address_id
        else None
    )

    return {
        "employee_code": employee.employee_code,

        "first_name": employee.first_name,
        "last_name": employee.last_name,
        "email": employee.email,

        "role_name": role.name if role else None,

        "department_name": (
            department.department_name if department else None
        ),
        "designation_name": (
            designation.designation_name if designation else None
        ),
        "manager_name": _full_name(manager) if manager else None,

        "phone": employee.phone,
        "dob": employee.dob,

        "date_of_joining": employee.date_of_joining,
        "employment_type": employee.employment_type,

        "address_line1": address.address_line1 if address else None,
        "address_line2": address.address_line2 if address else None,
        "city": address.city if address else None,
        "state": address.state if address else None,
        "country": address.country if address else None,
        "pincode": address.pincode if address else None,
    }


def update_employee_profile(
    db: Session,
    user: User,
    data: EmployeeProfileUpdate
):
    employee = _get_employee(db, user)

    fields = data.model_dump(exclude_unset=True)

    # Names are never blanked out by an empty value
    for key in ("first_name", "last_name"):
        value = (fields.get(key) or "").strip()

        if value:
            setattr(employee, key, value)

    if "phone" in fields:
        employee.phone = fields["phone"]

    if "dob" in fields:
        employee.dob = fields["dob"]

    # Address
    address_data = {}

    for key in ADDRESS_KEYS:
        if key in fields:
            value = fields[key]
            address_data[key] = value.strip() if isinstance(value, str) else value

    if address_data:

        if employee.residential_address_id:
            address = db.get(Address, employee.residential_address_id)

            if not address:
                raise HTTPException(
                    status_code=404,
                    detail="Residential address not found"
                )

            for key, value in address_data.items():
                if key == "address_line2":
                    # optional field: may be cleared
                    address.address_line2 = value or None
                elif value:
                    # required columns can never be blanked
                    setattr(address, key, value)

        else:
            missing = [
                key
                for key in ADDRESS_REQUIRED
                if not address_data.get(key)
            ]

            if missing:
                raise HTTPException(
                    status_code=400,
                    detail="Missing address fields: " + ", ".join(missing)
                )

            address = Address(
                address_line1=address_data["address_line1"],
                address_line2=address_data.get("address_line2") or None,
                city=address_data["city"],
                state=address_data["state"],
                country=address_data["country"],
                pincode=address_data["pincode"],
            )

            db.add(address)
            db.flush()

            employee.residential_address_id = address.address_id

    # The profile only counts as complete when everything is filled in
    incomplete = []

    if not employee.first_name:
        incomplete.append("first name")
    if not employee.last_name:
        incomplete.append("last name")
    if not employee.phone:
        incomplete.append("phone")
    if not employee.dob:
        incomplete.append("date of birth")
    if not employee.residential_address_id:
        incomplete.append("address")

    if incomplete:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Please complete: " + ", ".join(incomplete)
        )

    user.profile_completed = True

    # Onboarding -> Active (joining date already reached)
    if (
        employee.status == "ONBOARDING"
        and employee.date_of_joining <= date.today()
    ):
        employee.status = "ACTIVE"

    db.commit()
    db.refresh(employee)

    return get_employee_profile(db, user)


def get_employee_lookups(db: Session, current_user: User):

    creator_role = db.get(Role, current_user.role_id)

    allowed_names = assignable_role_names(
        creator_role.name if creator_role else None
    )

    # Only the roles this user is actually allowed to hand out
    roles = (
        db.query(Role)
        .filter(Role.name.in_(allowed_names))
        .order_by(Role.name)
        .all()
    )

    departments = (
        db.query(Department)
        .order_by(Department.department_name)
        .all()
    )

    designations = (
        db.query(Designation)
        .order_by(Designation.designation_name)
        .all()
    )

    # Reporting managers = active users whose role is MANAGER
    managers = (
        db.query(Employee)
        .join(User, User.employee_id == Employee.employee_id)
        .join(Role, Role.id == User.role_id)
        .filter(Role.name == MANAGER, User.is_active.is_(True))
        .order_by(Employee.first_name, Employee.last_name)
        .all()
    )

    return {
        "roles": [
            {"id": role.id, "name": role_label(role.name)}
            for role in roles
        ],

        "departments": [
            {
                "id": department.department_id,
                "name": department.department_name
            }
            for department in departments
        ],

        "designations": [
            {
                "id": designation.designation_id,
                "name": designation.designation_name
            }
            for designation in designations
        ],

        "managers": [
            {
                "id": manager.employee_id,
                "name": _full_name(manager)
            }
            for manager in managers
        ],
    }


def _format_employee_detail(db: Session, employee: Employee) -> dict:
    user = (
        db.query(User)
        .filter(User.employee_id == employee.employee_id)
        .first()
    )

    role = db.get(Role, user.role_id) if (user and user.role_id) else None
    department = (
        db.get(Department, employee.department_id)
        if employee.department_id
        else None
    )
    designation = (
        db.get(Designation, employee.designation_id)
        if employee.designation_id
        else None
    )
    manager = (
        db.get(Employee, employee.manager_id)
        if employee.manager_id
        else None
    )
    address = (
        db.get(Address, employee.residential_address_id)
        if employee.residential_address_id
        else None
    )

    return {
        "employee_id": employee.employee_id,
        "employee_code": employee.employee_code,
        "first_name": employee.first_name,
        "last_name": employee.last_name,
        "email": employee.email,
        "phone": employee.phone,
        "dob": employee.dob,
        "date_of_joining": employee.date_of_joining,
        "employment_type": employee.employment_type,
        "status": employee.status,
        "role_id": user.role_id if user else None,
        "role_name": role_label(role.name) if role else None,
        "department_id": employee.department_id,
        "department_name": department.department_name if department else None,
        "designation_id": employee.designation_id,
        "designation_name": designation.designation_name if designation else None,
        "manager_id": employee.manager_id,
        "manager_name": _full_name(manager) if manager else None,
        "profile_completed": user.profile_completed if user else False,
        "is_active": user.is_active if user else True,
        "address_line1": address.address_line1 if address else None,
        "address_line2": address.address_line2 if address else None,
        "city": address.city if address else None,
        "state": address.state if address else None,
        "country": address.country if address else None,
        "pincode": address.pincode if address else None,
    }


def list_employees(db: Session, current_user: User):
    if current_user.role_id not in (1, 2, 4):
        raise HTTPException(status_code=403, detail="Permission denied")

    employees = (
        db.query(Employee)
        .order_by(Employee.employee_id.desc())
        .all()
    )
    return [_format_employee_detail(db, emp) for emp in employees]


def get_employee_by_id(db: Session, employee_id: int, current_user: User):
    if (
        current_user.role_id not in (1, 2, 4)
        and current_user.employee_id != employee_id
    ):
        raise HTTPException(status_code=403, detail="Permission denied")

    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    return _format_employee_detail(db, employee)


def get_employee_stats(db: Session, current_user: User):
    if current_user.role_id not in (1, 2, 4):
        raise HTTPException(status_code=403, detail="Permission denied")

    total_employees = db.query(Employee).count()
    active_employees = (
        db.query(Employee)
        .filter(Employee.status == "ACTIVE")
        .count()
    )
    onboarding_employees = (
        db.query(Employee)
        .filter(Employee.status == "ONBOARDING")
        .count()
    )
    total_departments = db.query(Department).count()

    return {
        "total_employees": total_employees,
        "active_employees": active_employees,
        "onboarding_employees": onboarding_employees,
        "total_departments": total_departments,
    }


def update_employee_status(
    db: Session,
    employee_id: int,
    new_status: str,
    current_user: User,
):
    target_status = (new_status or "").upper().strip()
    if target_status not in ("ACTIVE", "INACTIVE"):
        raise HTTPException(
            status_code=400,
            detail="Status must be either ACTIVE or INACTIVE"
        )

    # Prevent self-deactivation
    if current_user.employee_id == employee_id and target_status == "INACTIVE":
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own account"
        )

    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    user = db.query(User).filter(User.employee_id == employee_id).first()

    employee.status = target_status
    if user:
        if target_status == "INACTIVE":
            user.is_active = False
            # Bump token_version so any existing JWT tokens are immediately invalidated
            user.token_version = (user.token_version or 0) + 1
        else:
            user.is_active = True

    db.commit()
    db.refresh(employee)
    if user:
        db.refresh(user)

    return _format_employee_detail(db, employee)


def update_employee_by_id(
    db: Session,
    employee_id: int,
    data: EmployeeProfileUpdate,
    current_user: User,
):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    fields = data.model_dump(exclude_unset=True)

    for key in ("first_name", "last_name"):
        if key in fields and fields[key] is not None:
            value = fields[key].strip()
            if not value:
                raise HTTPException(
                    status_code=400,
                    detail=f"{key.replace('_', ' ').capitalize()} cannot be empty or whitespace only"
                )
            setattr(employee, key, value)

    if "phone" in fields:
        employee.phone = fields["phone"]

    if "dob" in fields:
        employee.dob = fields["dob"]

    # Address
    address_data = {}
    for key in ADDRESS_KEYS:
        if key in fields:
            value = fields[key]
            address_data[key] = value.strip() if isinstance(value, str) else value

    if address_data:
        if employee.residential_address_id:
            address = db.get(Address, employee.residential_address_id)
            if not address:
                raise HTTPException(
                    status_code=404,
                    detail="Residential address not found"
                )
            for key, value in address_data.items():
                if key == "address_line2":
                    address.address_line2 = value or None
                elif value:
                    setattr(address, key, value)
        else:
            missing = [k for k in ADDRESS_REQUIRED if not address_data.get(k)]
            if missing:
                raise HTTPException(
                    status_code=400,
                    detail="Missing address fields: " + ", ".join(missing)
                )
            address = Address(
                address_line1=address_data["address_line1"],
                address_line2=address_data.get("address_line2") or None,
                city=address_data["city"],
                state=address_data["state"],
                country=address_data["country"],
                pincode=address_data["pincode"],
            )
            db.add(address)
            db.flush()
            employee.residential_address_id = address.address_id

    # Check if user profile is complete
    user = db.query(User).filter(User.employee_id == employee.employee_id).first()
    if user and not user.profile_completed:
        if (
            employee.first_name
            and employee.last_name
            and employee.phone
            and employee.dob
            and employee.residential_address_id
        ):
            user.profile_completed = True

    db.commit()
    db.refresh(employee)
    if user:
        db.refresh(user)

    return _format_employee_detail(db, employee)


def reset_employee_password(
    db: Session,
    employee_id: int,
    current_user: User,
):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    user = db.query(User).filter(User.employee_id == employee_id).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User account not found for this employee"
        )

    # Generate secure temporary password
    temp_password = generate_temporary_password()

    user.password_hash = hash_password(temp_password)
    user.must_change_password = True
    user.token_version = (user.token_version or 0) + 1

    db.commit()
    db.refresh(user)

    # Send reset email
    email_body = (
        f"Hello {employee.first_name or 'Employee'},\n\n"
        f"Your HRMS account password has been reset by an administrator.\n"
        f"Your temporary password is: {temp_password}\n\n"
        f"Please log in to the HRMS portal and you will be prompted to set a new password on your first login.\n\n"
        f"Best regards,\nHRMS Team"
    )
    email_sent = send_email(
        to=user.email,
        subject="HRMS Account - Password Reset",
        body=email_body,
    )

    response = {
        "message": f"Password reset successfully. A temporary password was dispatched to {user.email}.",
        "email_sent": email_sent,
    }
    if settings.environment == "development":
        response["temporary_password"] = temp_password

    return response