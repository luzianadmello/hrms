import re
from datetime import date

from pydantic import BaseModel, ConfigDict, field_validator

# "+<dial code> <digits>", e.g. "+91 9876543210"
PHONE_PATTERN = re.compile(r"^\+\d{1,5} \d{4,15}$")


class EmployeeProfileUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    dob: date | None = None

    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    pincode: str | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_name(cls, value: str | None):
        if value is not None and not value.strip():
            raise ValueError("Name cannot be empty or whitespace only")
        return value.strip() if value else None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None):
        if value is None or not value.strip():
            return None

        value = value.strip()

        if not PHONE_PATTERN.match(value):
            raise ValueError(
                "Phone must look like '+91 9876543210' "
                "(country code, space, digits only)"
            )

        return value

    @field_validator("dob")
    @classmethod
    def validate_dob(cls, value: date | None):
        if value is None:
            return None

        today = date.today()
        if value > today:
            raise ValueError("Date of birth cannot be in the future")

        age = (
            today.year
            - value.year
            - ((today.month, today.day) < (value.month, value.day))
        )
        if age < 18:
            raise ValueError("Employee must be at least 18 years old")

        return value

    @field_validator("pincode")
    @classmethod
    def validate_pincode(cls, value: str | None):
        if value is not None and value.strip():
            v = value.strip()
            if len(v) < 3 or len(v) > 12:
                raise ValueError("Pincode must be between 3 and 12 characters")
            return v
        return value


class EmployeeStatusUpdateRequest(BaseModel):
    status: str


class PasswordResetResponse(BaseModel):
    message: str
    email_sent: bool
    temporary_password: str | None = None


class EmployeeProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    employee_code: str

    first_name: str | None
    last_name: str | None
    email: str

    role_name: str | None

    department_name: str | None
    designation_name: str | None
    manager_name: str | None

    phone: str | None
    dob: date | None

    date_of_joining: date
    employment_type: str

    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    pincode: str | None = None


class LookupItem(BaseModel):
    id: int
    name: str


class EmployeeLookupsResponse(BaseModel):
    roles: list[LookupItem]
    departments: list[LookupItem]
    designations: list[LookupItem]
    managers: list[LookupItem]


class EmployeeDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    employee_id: int
    employee_code: str
    first_name: str | None = None
    last_name: str | None = None
    email: str
    phone: str | None = None
    dob: date | None = None
    date_of_joining: date
    employment_type: str
    status: str
    role_id: int | None = None
    role_name: str | None = None
    department_id: int | None = None
    department_name: str | None = None
    designation_id: int | None = None
    designation_name: str | None = None
    manager_id: int | None = None
    manager_name: str | None = None
    profile_completed: bool = False
    is_active: bool = True

    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    pincode: str | None = None


class EmployeeStatsResponse(BaseModel):
    total_employees: int
    active_employees: int
    onboarding_employees: int
    total_departments: int