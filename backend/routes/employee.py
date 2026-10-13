from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.user import User

from schemas.employee import (
    EmployeeProfileUpdate,
    EmployeeProfileResponse,
    EmployeeLookupsResponse,
    EmployeeDetailResponse,
    EmployeeStatsResponse,
    EmployeeStatusUpdateRequest,
    PasswordResetResponse,
)
from schemas.user import (
    CreateEmployeeRequest,
    CreateEmployeeResponse,
)

from services.employee_service import (
    get_employee_profile,
    update_employee_profile,
    get_employee_lookups,
    list_employees,
    get_employee_by_id,
    get_employee_stats,
    update_employee_status,
    update_employee_by_id,
    reset_employee_password,
)
from services.user_service import create_employee

from utils.dependencies import get_current_user, require_permission


router = APIRouter(
    prefix="/employees",
    tags=["Employees"]
)


# ============================================================
# GET EMPLOYEE STATS
# ============================================================

@router.get(
    "/stats",
    response_model=EmployeeStatsResponse
)
def employee_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_employee_stats(
        db,
        current_user
    )


# ============================================================
# GET EMPLOYEE LOOKUPS
# ============================================================

@router.get(
    "/lookups",
    response_model=EmployeeLookupsResponse
)
def employee_lookups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_employee_lookups(
        db,
        current_user
    )


# ============================================================
# GET MY PROFILE
# ============================================================

@router.get(
    "/me",
    response_model=EmployeeProfileResponse
)
def my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_employee_profile(
        db,
        current_user
    )


# ============================================================
# UPDATE MY PROFILE
# ============================================================

@router.put(
    "/me",
    response_model=EmployeeProfileResponse
)
def update_my_profile(
    data: EmployeeProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_employee_profile(
        db,
        current_user,
        data
    )


# ============================================================
# LIST EMPLOYEES
# ============================================================

@router.get(
    "",
    response_model=list[EmployeeDetailResponse]
)
def get_all_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_employees(
        db,
        current_user
    )


# ============================================================
# CREATE EMPLOYEE
# ============================================================

@router.post(
    "",
    response_model=CreateEmployeeResponse
)
def create_new_employee(
    data: CreateEmployeeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_employee(
        db,
        data,
        current_user
    )


# ============================================================
# GET EMPLOYEE BY ID
# ============================================================

@router.get(
    "/{employee_id}",
    response_model=EmployeeDetailResponse
)
def get_single_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_employee_by_id(
        db,
        employee_id,
        current_user
    )


# ============================================================
# UPDATE EMPLOYEE STATUS (ACTIVATE / DEACTIVATE)
# ============================================================

@router.patch(
    "/{employee_id}/status",
    response_model=EmployeeDetailResponse
)
def change_employee_status(
    employee_id: int,
    payload: EmployeeStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = payload.status.upper().strip()
    required_perm = "user.activate" if target == "ACTIVE" else "user.deactivate"
    permission_checker = require_permission(required_perm)
    permission_checker(current_user=current_user, db=db)
    return update_employee_status(db, employee_id, target, current_user)


# ============================================================
# UPDATE EMPLOYEE BY ID (HR / ADMIN)
# ============================================================

@router.put(
    "/{employee_id}",
    response_model=EmployeeDetailResponse
)
def update_single_employee(
    employee_id: int,
    data: EmployeeProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user.update")),
):
    return update_employee_by_id(db, employee_id, data, current_user)


# ============================================================
# RESET EMPLOYEE PASSWORD (AUTHORIZED HR / ADMIN)
# ============================================================

@router.post(
    "/{employee_id}/reset-password",
    response_model=PasswordResetResponse
)
def reset_single_employee_password(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user.reset_password")),
):
    return reset_employee_password(db, employee_id, current_user)