from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models.user import User
from schemas.employee import EmployeeProfileUpdate, EmployeeProfileResponse
from schemas.user import CreateEmployeeRequest
from services.employee_service import get_employee_profile, update_employee_profile
from services.user_service import create_employee
from utils.dependencies import get_db, get_ready_user, require_permission

router = APIRouter(prefix="/employees", tags=["Employee"])


@router.post("")
def create_employee_account(
    employee_data: CreateEmployeeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user.create")),
):
    return create_employee(db, employee_data, current_user)


@router.get("/me", response_model=EmployeeProfileResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_ready_user),
):
    return get_employee_profile(db, current_user)


@router.put("/me", response_model=EmployeeProfileResponse)
def update_my_profile(
    profile_data: EmployeeProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_ready_user),
):
    return update_employee_profile(db, current_user, profile_data)