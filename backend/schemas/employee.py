import re
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, field_validator

from schemas.user import EmploymentType

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


class EmployeeHRUpdate(EmployeeProfileUpdate):
    """What HR / Admin may change on someone else's record.

    Everything in EmployeeProfileUpdate, plus the company fields. Unknown
    fields are rejected (422) instead of being silently ignored.
    Not editable here: employee id/code, work email, status, role,
    profile_completed, last login (system-generated or changed by actions).
    """

    model_config = ConfigDict(extra="forbid")

    department_id: int | None = None
    designation_id: int | None = None
    manager_id: int | None = None
    employment_type: str | None = None
    date_of_joining: date | None = None

    @field_validator("employment_type")
    @classmethod
    def validate_employment_type(cls, value: str | None):
        if value is None:
            return None
        allowed = [member.value for member in EmploymentType]
        if value not in allowed:
            raise ValueError("Employment type must be one of: " + ", ".join(allowed))
        return value


class EmployeeStatusUpdateRequest(BaseModel):
    status: str


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
    last_login: datetime | None = None

    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    pincode: str | None = None


class StatusChangeResponse(EmployeeDetailResponse):
    # Confirms the action without exposing credentials or email contents.
    message: str | None = None


class EmployeeStatsResponse(BaseModel):
    total_employees: int
    active_employees: int
    inactive_employees: int
    total_departments: int
    profile_incomplete: int = 0


class PasswordResetResponse(BaseModel):
    message: str
    email_sent: bool
