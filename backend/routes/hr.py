from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import engine
from models.user import User

from schemas.user import CreateEmployeeRequest
from services.user_service import create_employee

from utils.dependencies import require_hr


router = APIRouter(
    prefix="/hr",
    tags=["HR"]
)


def get_db():
    db = Session(bind=engine)

    try:
        yield db
    finally:
        db.close()


@router.post("/employees")
def create_employee_account(
    employee_data: CreateEmployeeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr)
):
    return create_employee(
        db,
        employee_data
    )