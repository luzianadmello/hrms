from pydantic import BaseModel, ConfigDict, Field


class LeaveTypeCreate(BaseModel):
    leave_type_name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    is_paid: bool = True


class LeaveTypeUpdate(BaseModel):
    leave_type_name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    is_paid: bool | None = None


class LeaveTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    leave_type_id: int
    leave_type_name: str
    description: str | None = None
    is_paid: bool


class LeaveTypeListResponse(BaseModel):
    items: list[LeaveTypeResponse]
    total: int
    page: int
    page_size: int
