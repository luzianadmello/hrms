
import logging

from fastapi import HTTPException
from sqlalchemy.orm import Session, aliased

from models.address import Address
from models.department import Department
from models.designation import Designation
from models.employee import Employee
from models.role import Role
from models.user import User

from schemas.employee import EmployeeHRUpdate, EmployeeProfileUpdate

from services.user_service import generate_temporary_password
from utils.email import send_email
from utils.security import hash_password
from services.auth_service import revoke_user_sessions

from utils.roles import role_label
from utils.rbac import creatable_role_ids, manager_employee_query

audit_log = logging.getLogger("hrms.audit")

# The only two statuses. "Active" means the person can log in.
ACTIVE = "ACTIVE"
INACTIVE = "INACTIVE"

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
            detail="Employee profile not found",
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
        "department_name": department.department_name if department else None,
        "designation_name": designation.designation_name if designation else None,
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
    data: EmployeeProfileUpdate,
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
            address_data[key] = (
                value.strip() if isinstance(value, str) else value
            )

    if address_data:
        if employee.residential_address_id:
            address = db.get(Address, employee.residential_address_id)

            if not address:
                raise HTTPException(
                    status_code=404,
                    detail="Residential address not found",
                )

            for key, value in address_data.items():
                if key == "address_line2":
                    # Optional field: may be cleared
                    address.address_line2 = value or None
                elif value:
                    # Required columns can never be blanked
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
                    detail="Missing address fields: " + ", ".join(missing),
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
            detail="Please complete: " + ", ".join(incomplete),
        )

    user.profile_completed = True

    db.commit()
    db.refresh(employee)

    return get_employee_profile(db, user)


def get_employee_lookups(db: Session, current_user: User):
    allowed_ids = creatable_role_ids(db, current_user.role_id)

    roles = (
        db.query(Role)
        .filter(Role.id.in_(allowed_ids))
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

    # Reporting managers = people whose role can view a team (decided by the
    # employee.view_team permission in the database, not by a role name)
    managers = (
        manager_employee_query(db)
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
                "name": department.department_name,
            }
            for department in departments
        ],
        "designations": [
            {
                "id": designation.designation_id,
                "name": designation.designation_name,
            }
            for designation in designations
        ],
        "managers": [
            {
                "id": manager.employee_id,
                "name": _full_name(manager),
            }
            for manager in managers
        ],
    }


def _detail_query(db: Session):
    """One joined query for everything a detail row needs (no N+1)."""
    Manager = aliased(Employee)

    return (
        db.query(
            Employee,
            User,
            Role,
            Department,
            Designation,
            Manager,
            Address,
        )
        .outerjoin(User, User.employee_id == Employee.employee_id)
        .outerjoin(Role, Role.id == User.role_id)
        .outerjoin(
            Department,
            Department.department_id == Employee.department_id,
        )
        .outerjoin(
            Designation,
            Designation.designation_id == Employee.designation_id,
        )
        .outerjoin(Manager, Manager.employee_id == Employee.manager_id)
        .outerjoin(
            Address,
            Address.address_id == Employee.residential_address_id,
        )
    )


def _to_detail(
    employee: Employee,
    user: User | None,
    role: Role | None,
    department: Department | None,
    designation: Designation | None,
    manager: Employee | None,
    address: Address | None,
) -> dict:
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
        "last_login": user.last_login if user else None,
        "address_line1": address.address_line1 if address else None,
        "address_line2": address.address_line2 if address else None,
        "city": address.city if address else None,
        "state": address.state if address else None,
        "country": address.country if address else None,
        "pincode": address.pincode if address else None,
    }


def _limit_for_team(detail: dict) -> dict:
    """What a manager sees of a report: work details only.

    Date of birth and home address stay private to the employee and HR.
    """
    limited = dict(detail)

    for key in (
        "dob",
        "phone",
        "last_login",
        "address_line1",
        "address_line2",
        "city",
        "state",
        "country",
        "pincode",
    ):
        limited[key] = None

    limited["profile_completed"] = False
    return limited


def _format_employee_detail(db: Session, employee: Employee) -> dict:
    row = (
        _detail_query(db)
        .filter(Employee.employee_id == employee.employee_id)
        .first()
    )

    return _to_detail(*row)


def list_employees(db: Session, current_user: User, view_scope: str):
    query = _detail_query(db)
    team_view = view_scope == "team"

    if team_view:
        query = query.filter(Employee.manager_id == current_user.employee_id)

    rows = query.order_by(Employee.employee_id.desc()).all()
    result = [_to_detail(*row) for row in rows]

    if team_view:
        result = [_limit_for_team(item) for item in result]

    return result


def get_employee_by_id(db: Session, employee_id: int, current_user: User, view_scope: str):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    is_self = current_user.employee_id == employee_id
    sees_all = view_scope == "all"
    sees_team = view_scope == "team" and employee.manager_id == current_user.employee_id

    if not (is_self or sees_all or sees_team):
        raise HTTPException(status_code=403, detail="Permission denied")

    detail = _format_employee_detail(db, employee)

    # A manager sees a report's work details, not their private data
    if sees_team and not (is_self or sees_all):
        detail = _limit_for_team(detail)

    return detail


def get_employee_stats(db: Session, view_scope: str, current_user: User):
    employee_scope_query = db.query(Employee)
    if view_scope == "team":
        employee_scope_query = employee_scope_query.filter(Employee.manager_id == current_user.employee_id)

    def count_status(status: str) -> int:
        return employee_scope_query.filter(Employee.status == status).count()

    # Active people who still have something left to do
    active_with_user = (
        employee_scope_query
        .join(User, User.employee_id == Employee.employee_id)
        .filter(Employee.status == ACTIVE)
    )

    return {
        "total_employees": employee_scope_query.count(),
        "active_employees": count_status(ACTIVE),
        "inactive_employees": count_status(INACTIVE),
        "total_departments": db.query(Department).count() if view_scope == "all" else 0,
        "profile_incomplete": active_with_user.filter(
            User.profile_completed.is_(False)
        ).count(),
    }


def _load_employee_and_user(db: Session, employee_id: int):
    employee = db.get(Employee, employee_id)

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found",
        )

    user = (
        db.query(User)
        .filter(User.employee_id == employee_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User account not found for this employee",
        )

    return employee, user


def _apply_status(employee: Employee, user: User, active: bool) -> None:
    """The one place a status changes.

    employees.status and users.is_active always move together, so they can
    never disagree about whether this person can log in.
    """
    employee.status = ACTIVE if active else INACTIVE
    user.is_active = active


def update_employee_status(
    db: Session,
    employee_id: int,
    new_status: str,
    current_user: User,
):
    target_status = (new_status or "").upper().strip()

    if target_status not in (ACTIVE, INACTIVE):
        raise HTTPException(
            status_code=400,
            detail="Status must be either ACTIVE or INACTIVE",
        )

    # Prevent self-deactivation
    if (
        current_user.employee_id == employee_id
        and target_status == INACTIVE
    ):
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own account",
        )

    employee, user = _load_employee_and_user(db, employee_id)

    if target_status == ACTIVE:
        return _activate(db, employee, user, current_user)

    return _deactivate(db, employee, user, current_user)


def _activate(
    db: Session,
    employee: Employee,
    user: User,
    current_user: User,
):
    """Inactive -> Active: new temporary password, emailed to the employee.

    Every activation (first time or an ex-employee coming back) creates a
    new password, so an old one never works again.
    """
    if employee.status == ACTIVE and user.is_active:
        raise HTTPException(
            status_code=400,
            detail="This employee is already active",
        )

    temp_password = generate_temporary_password()

    email_body = (
        f"Hello {employee.first_name or 'there'},\n\n"
        f"Your HRMS account is ready.\n\n"
        f"Login email: {user.email}\n"
        f"Temporary password: {temp_password}\n\n"
        f"Log in to the HRMS portal. You will be asked to set a new "
        f"password and then complete your profile.\n\n"
        f"Best regards,\nHRMS Team"
    )

    # Send first: if the email fails nothing has changed (they stay
    # Inactive), so there is never an active account nobody can open.
    email_sent = send_email(
        to=user.email,
        subject="Your HRMS account",
        body=email_body,
    )

    if not email_sent:
        raise HTTPException(
            status_code=502,
            detail="The email could not be sent. Nothing was changed; please try again.",
        )

    user.password_hash = hash_password(temp_password)
    user.must_change_password = True

    # Nothing from before the activation may survive it
    revoke_user_sessions(db, user.user_id)

    _apply_status(employee, user, True)

    audit_log.info(
        "user %s activated employee %s",
        current_user.user_id,
        employee.employee_id,
    )

    db.commit()
    db.refresh(employee)
    db.refresh(user)

    result = _format_employee_detail(db, employee)
    result["message"] = f"Login details were emailed to {user.email}."

    return result


def _deactivate(
    db: Session,
    employee: Employee,
    user: User,
    current_user: User,
):
    if employee.status == INACTIVE and not user.is_active:
        raise HTTPException(
            status_code=400,
            detail="This employee is already inactive",
        )

    _apply_status(employee, user, False)

    # Ends every session: no refresh token survives, and the
    # is_active check blocks any access token still in flight.
    revoke_user_sessions(db, user.user_id)

    audit_log.info(
        "user %s deactivated employee %s",
        current_user.user_id,
        employee.employee_id,
    )

    db.commit()
    db.refresh(employee)
    db.refresh(user)

    return _format_employee_detail(db, employee)


def _validate_new_manager(db: Session, employee: Employee, manager_id):
    if manager_id is None:
        return

    if manager_id == employee.employee_id:
        raise HTTPException(
            status_code=400,
            detail="An employee cannot report to themselves",
        )

    if not (
        manager_employee_query(db)
        .filter(Employee.employee_id == manager_id)
        .first()
    ):
        raise HTTPException(
            status_code=400,
            detail="The selected person cannot be a reporting manager",
        )

    # No reporting loops: the new manager must not already report (directly
    # or through others) to this employee
    seen: set[int] = set()
    current = db.get(Employee, manager_id)

    while current is not None and current.manager_id is not None:
        if current.manager_id == employee.employee_id:
            raise HTTPException(
                status_code=400,
                detail="That manager already reports to this employee",
            )

        if current.manager_id in seen:
            break

        seen.add(current.manager_id)
        current = db.get(Employee, current.manager_id)


def update_employee_by_id(
    db: Session,
    employee_id: int,
    data: EmployeeHRUpdate,
    current_user: User,
):
    employee, target_user = _load_employee_and_user(db, employee_id)

    fields = data.model_dump(exclude_unset=True)
    changes: dict[str, tuple] = {}

    for key in ("first_name", "last_name"):
        if key in fields and fields[key] is not None:
            value = fields[key].strip()

            if not value:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"{key.replace('_', ' ').capitalize()} "
                        "cannot be empty or whitespace only"
                    ),
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
            address_data[key] = (
                value.strip() if isinstance(value, str) else value
            )

    if address_data:
        if employee.residential_address_id:
            address = db.get(Address, employee.residential_address_id)

            if not address:
                raise HTTPException(
                    status_code=404,
                    detail="Residential address not found",
                )

            for key, value in address_data.items():
                if key == "address_line2":
                    address.address_line2 = value or None
                elif value:
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
                    detail="Missing address fields: " + ", ".join(missing),
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

    # Company details (HR / Admin only)
    if "department_id" in fields:
        if fields["department_id"] is None or not db.get(
            Department, fields["department_id"]
        ):
            raise HTTPException(status_code=400, detail="Invalid department")

        changes["department_id"] = (
            employee.department_id,
            fields["department_id"],
        )
        employee.department_id = fields["department_id"]

    if "designation_id" in fields:
        if fields["designation_id"] is None or not db.get(
            Designation, fields["designation_id"]
        ):
            raise HTTPException(status_code=400, detail="Invalid designation")

        changes["designation_id"] = (
            employee.designation_id,
            fields["designation_id"],
        )
        employee.designation_id = fields["designation_id"]

    # Only checked when it actually changes, so saving an unrelated edit is
    # never blocked by a manager who has since left
    if "manager_id" in fields and fields["manager_id"] != employee.manager_id:
        _validate_new_manager(db, employee, fields["manager_id"])

        changes["manager_id"] = (employee.manager_id, fields["manager_id"])
        employee.manager_id = fields["manager_id"]

    if "employment_type" in fields:
        if fields["employment_type"] is None:
            raise HTTPException(
                status_code=400,
                detail="Employment type cannot be empty",
            )

        changes["employment_type"] = (
            employee.employment_type,
            fields["employment_type"],
        )
        employee.employment_type = fields["employment_type"]

    if "date_of_joining" in fields:
        if fields["date_of_joining"] is None:
            raise HTTPException(
                status_code=400,
                detail="Date of joining cannot be empty",
            )

        changes["date_of_joining"] = (
            employee.date_of_joining,
            fields["date_of_joining"],
        )
        employee.date_of_joining = fields["date_of_joining"]

    for field_name, (old, new) in changes.items():
        if old != new:
            audit_log.info(
                "user %s changed employee %s: %s %r -> %r",
                current_user.user_id,
                employee.employee_id,
                field_name,
                old,
                new,
            )

    # Check if user profile is complete
    user = target_user

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
        raise HTTPException(
            status_code=404,
            detail="Employee not found",
        )

    user = (
        db.query(User)
        .filter(User.employee_id == employee_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User account not found for this employee",
        )

    # An inactive account cannot log in, so a new password would not help.
    # Activate is the way to (re)start their access.
    if employee.status == INACTIVE:
        raise HTTPException(
            status_code=400,
            detail="This employee is inactive. Activate them instead.",
        )

    # Generate secure temporary password
    temp_password = generate_temporary_password()

    user.password_hash = hash_password(temp_password)
    user.must_change_password = True

    revoke_user_sessions(db, user.user_id)

    db.commit()
    db.refresh(user)

    # Send reset email
    email_body = (
        f"Hello {employee.first_name or 'Employee'},\n\n"
        f"Your HRMS account password has been reset by an administrator.\n"
        f"Your temporary password is: {temp_password}\n\n"
        f"Please log in to the HRMS portal and you will be prompted "
        f"to set a new password on your first login.\n\n"
        f"Best regards,\nHRMS Team"
    )

    email_sent = send_email(
        to=user.email,
        subject="HRMS Account - Password Reset",
        body=email_body,
    )

    response = {
        "message": f"Password reset successfully. Login details sent to {user.email}.",
        "email_sent": email_sent,
    }

    return response
