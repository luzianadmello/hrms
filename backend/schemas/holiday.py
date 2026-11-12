from datetime import date, datetime
from pydantic import BaseModel, Field, ConfigDict

class HolidayCreate(BaseModel):
    holiday_name: str = Field(min_length=1, max_length=100)
    holiday_date: date
    description: str | None = None

class HolidayUpdate(BaseModel):
    holiday_name: str | None = Field(default=None, min_length=1, max_length=100)
    holiday_date: date | None = None
    description: str | None = None

class HolidayResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    holiday_id: int
    holiday_name: str
    holiday_date: date
    description: str | None = None
    created_at: datetime
    updated_at: datetime

class HolidayListResponse(BaseModel):
    items: list[HolidayResponse]
    total: int
    page: int
    page_size: int
