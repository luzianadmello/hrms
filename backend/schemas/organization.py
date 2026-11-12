from pydantic import BaseModel, ConfigDict, field_validator


class OrganizationRecordCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be empty")
        if len(value) > 120:
            raise ValueError("Name must be 120 characters or fewer")
        return value


class OrganizationRecordUpdate(OrganizationRecordCreate):
    pass


class OrganizationRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    status: str
    employee_count: int


class OrganizationStatsResponse(BaseModel):
    total: int
    active: int
    inactive: int
