from datetime import date

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.address import Address
from models.employee import Employee
from models.user import User
from schemas.employee import EmployeeProfileUpdate


ADDRESS_KEYS = [
    "address_line1",
    "address_line2",
    "city",
    "state",
    "country",
    "pincode"
]

ADDRESS_REQUIRED = [
    "address_line1",
    "city",
    "state",
    "country",
    "pincode"
]


def _get_employee(
    db: Session,
    user: User
) -> Employee:

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


def get_employee_profile(
    db: Session,
    user: User
):
    return _get_employee(db, user)


def update_employee_profile(
    db: Session,
    user: User,
    data: EmployeeProfileUpdate
):

    employee = _get_employee(db, user)

    fields = data.model_dump(
        exclude_unset=True
    )

    address_data = {
        key: fields[key]
        for key in ADDRESS_KEYS
        if key in fields
    }

    # -------------------------
    # PHONE
    # -------------------------

    if "phone" in fields:
        employee.phone = fields["phone"]

    # -------------------------
    # DATE OF BIRTH
    # -------------------------

    if "dob" in fields:

        if (
            employee.dob is not None
            and fields["dob"] != employee.dob
        ):
            raise HTTPException(
                status_code=403,
                detail="Contact HR to change your date of birth"
            )

        employee.dob = fields["dob"]

    # -------------------------
    # ADDRESS
    # -------------------------

    if address_data:

        if employee.residential_address_id:

            address = db.get(
                Address,
                employee.residential_address_id
            )

            if not address:
                raise HTTPException(
                    status_code=404,
                    detail="Residential address not found"
                )

            for key, value in address_data.items():

                if value is not None:
                    setattr(
                        address,
                        key,
                        value
                    )

        else:

            missing = [
                key
                for key in ADDRESS_REQUIRED
                if not address_data.get(key)
            ]

            if missing:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Missing address fields: "
                        + ", ".join(missing)
                    )
                )

            address = Address(
                **address_data
            )

            db.add(address)
            db.flush()

            employee.residential_address_id = (
                address.address_id
            )

    # -------------------------
    # EMPLOYEE STATUS
    # -------------------------

    if (
        employee.status == "ONBOARDING"
        and employee.date_of_joining <= date.today()
    ):
        employee.status = "ACTIVE"

    db.commit()
    db.refresh(employee)

    return employee