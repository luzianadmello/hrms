from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class LeaveRequestCreate(BaseModel):
    leave_type_id: int = Field(gt=0)
    start_date: date
    end_date: date
    reason: str = Field(min_length=1, max_length=2000)
    is_half_day: bool = False

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Reason cannot be empty.")
        return value

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("End date cannot be before start date.")

        if self.is_half_day and self.start_date != self.end_date:
            raise ValueError("Half-day leave must be for a single date.")

        return self


class LeaveRequestReview(BaseModel):
    status: Literal["APPROVED", "REJECTED"]


class LeaveRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    leave_id: int
    employee_id: int
    leave_type_id: int
    start_date: date
    end_date: date
    days: Decimal
    reason: str
    status: str
    approved_by: int | None = None
    approved_on: datetime | None = None


class LeaveRequestListResponse(BaseModel):
    items: list[LeaveRequestResponse]
    total: int
    page: int
    page_size: int
