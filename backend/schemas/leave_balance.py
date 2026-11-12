from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class LeaveBalanceAllocation(BaseModel):
    leave_type_id: int = Field(gt=0)
    allocated_days: Decimal = Field(ge=0)


class LeaveBalanceCreate(BaseModel):
    employee_id: int = Field(gt=0)
    year: int = Field(ge=2000, le=2100)
    allocations: list[LeaveBalanceAllocation] = Field(min_length=1)


class LeaveBalanceUpdate(BaseModel):
    allocated_days: Decimal = Field(ge=0)


class LeaveBalanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    balance_id: int
    employee_id: int
    leave_type_id: int
    year: int
    allocated_days: Decimal
    used_days: Decimal
    remaining_days: Decimal


class LeaveBalanceListItem(BaseModel):
    employee_id: int
    employee_code: str
    employee_name: str
    year: int
    leave_balances: list["LeaveBalanceBreakdownItem"]


class LeaveBalanceBreakdownItem(BaseModel):
    leave_type_id: int
    leave_type_name: str
    is_paid: bool
    allocated_days: Decimal
    used_days: Decimal
    remaining_days: Decimal


class LeaveBalanceListResponse(BaseModel):
    items: list[LeaveBalanceListItem]
    total: int
    page: int
    page_size: int


class LeaveBalanceBulkResponse(BaseModel):
    items: list[LeaveBalanceResponse]
    total: int
    message: str


class MyLeaveBalanceResponse(BaseModel):
    employee_id: int
    employee_code: str
    employee_name: str
    year: int
    leave_balances: list[LeaveBalanceBreakdownItem]
