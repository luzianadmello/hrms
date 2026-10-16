from datetime import date
from enum import Enum

from pydantic import BaseModel, EmailStr, field_validator


class EmploymentType(str, Enum):
    FULL_TIME = "FULL_TIME"
    PART_TIME = "PART_TIME"
    CONTRACT = "CONTRACT"
    INTERN = "INTERN"


class CreateEmployeeRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    role_id: int
    date_of_joining: date
    employment_type: EmploymentType
    department_id: int
    designation_id: int
    manager_id: int | None = None
    dob: date | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_name(cls, value: str):
        if not value or not value.strip():
            raise ValueError("Name cannot be empty or whitespace only")
        return value.strip()

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr):
        val = str(value).strip().lower()
        if not val:
            raise ValueError("Email cannot be empty")
        return val

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


class CreateEmployeeResponse(BaseModel):
    message: str
    employee_id: int
    employee_code: str
    user_id: int
    role_id: int
    email: EmailStr
    status: str