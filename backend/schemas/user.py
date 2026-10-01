from datetime import date
from enum import Enum

from pydantic import BaseModel, EmailStr


class EmploymentType(str, Enum):
    FULL_TIME = "FULL_TIME"
    PART_TIME = "PART_TIME"
    CONTRACT = "CONTRACT"
    INTERN = "INTERN"


class CreateEmployeeRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr             # work email = login
    personal_email: EmailStr    # credentials are sent here
    role_id: int
    date_of_joining: date
    employment_type: EmploymentType
    department_id: int
    designation_id: int
    manager_id: int | None = None
    # no `status`: the system always starts people as ONBOARDING