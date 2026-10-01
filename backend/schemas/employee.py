from datetime import date, datetime
from pydantic import BaseModel, ConfigDict


class EmployeeProfileUpdate(BaseModel):
    # Employee-editable only. Name, department, designation, manager
    # are HR-owned and deliberately NOT here.
    phone: str | None = None
    dob: date | None = None

    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    pincode: str | None = None


class EmployeeProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    employee_id: int
    employee_code: str
    first_name: str | None
    last_name: str | None
    email: str
    phone: str | None
    dob: date | None
    date_of_joining: date
    employment_type: str
    status: str
    department_id: int | None
    designation_id: int | None
    manager_id: int | None
    residential_address_id: int | None
    profile_completed_at: datetime | None