from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.address import Address
from models.employee import Employee
from models.user import User
from schemas.employee import EmployeeProfileUpdate

ADDRESS_KEYS = ["address_line1", "address_line2", "city", "state", "country", "pincode"]
ADDRESS_REQUIRED = ["address_line1", "city", "state", "country", "pincode"]


def _get_employee(db: Session, user: User) -> Employee:
    employee = db.query(Employee).filter(Employee.employee_id == user.employee_id).first()
    if not employee:
        raise HTTPException(404, "Employee profile not found")
    return employee


def get_employee_profile(db: Session, user: User):
    return _get_employee(db, user)


def update_employee_profile(db: Session, user: User, data: EmployeeProfileUpdate):
    employee = _get_employee(db, user)
    fields = data.model_dump(exclude_unset=True)
    addr = {k: fields[k] for k in ADDRESS_KEYS if k in fields}

    if "phone" in fields:
        employee.phone = fields["phone"]

    if "dob" in fields:
        if employee.dob is not None and fields["dob"] != employee.dob:
            raise HTTPException(403, "Contact HR to change your date of birth")
        employee.dob = fields["dob"]

    if addr:
        if employee.residential_address_id:
            address = db.get(Address, employee.residential_address_id)
            for k, v in addr.items():
                if v is not None:
                    setattr(address, k, v)
        else:
            missing = [k for k in ADDRESS_REQUIRED if not addr.get(k)]
            if missing:
                raise HTTPException(400, f"Missing address fields: {', '.join(missing)}")
            address = Address(**addr)
            db.add(address)
            db.flush()
            employee.residential_address_id = address.address_id

    # Profile completion: mandatory set filled -> mark done, activate if joined
    if (
        employee.profile_completed_at is None
        and employee.phone
        and employee.dob
        and employee.residential_address_id
    ):
        employee.profile_completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        if employee.status == "ONBOARDING" and employee.date_of_joining <= date.today():
            employee.status = "ACTIVE"

    db.commit()
    db.refresh(employee)
    return employee