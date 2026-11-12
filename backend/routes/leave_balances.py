from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db

from schemas.leave_balance import (
    LeaveBalanceCreate,
    LeaveBalanceUpdate,
    LeaveBalanceResponse,
    LeaveBalanceListResponse,
    LeaveBalanceBulkResponse,
    MyLeaveBalanceResponse,
)

from services.leave_balance_service import (
    create_or_update_leave_balances,
    get_leave_balance,
    get_my_leave_balances,
    list_leave_balances,
    update_leave_balance,
)

from utils.dependencies import require_permission


router = APIRouter(
    prefix="/leave-balances",
    tags=["Leave Balances"],
)


VIEW_ALL = "leave_balance.view_all"
VIEW_OWN = "leave_balance.view_own"
MANAGE = "leave_balance.manage"


# ============================================================
# GET ALL EMPLOYEE LEAVE BALANCES (HR / ADMIN)
# ============================================================

@router.get(
    "",
    response_model=LeaveBalanceListResponse,
)
def read_leave_balances(
    employee_id: int | None = Query(None, gt=0),
    year: int = Query(date.today().year, ge=2000, le=2100),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
    _user=Depends(require_permission(VIEW_ALL)),
):
    return list_leave_balances(
        db,
        employee_id=employee_id,
        year=year,
        page=page,
        page_size=page_size,
    )


# ============================================================
# GET MY LEAVE BALANCES (EMPLOYEE)
# ============================================================

@router.get(
    "/my",
    response_model=MyLeaveBalanceResponse,
)
def read_my_leave_balances(
    year: int = Query(date.today().year, ge=2000, le=2100),
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(VIEW_OWN)),
):
    if current_user.employee_id is None:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=404,
            detail="No employee profile is linked to this account.",
        )

    return get_my_leave_balances(
        db,
        employee_id=current_user.employee_id,
        year=year,
    )


# ============================================================
# GET SINGLE LEAVE BALANCE RECORD
# ============================================================

@router.get(
    "/{balance_id}",
    response_model=LeaveBalanceResponse,
)
def read_leave_balance(
    balance_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_permission(VIEW_ALL)),
):
    return get_leave_balance(db, balance_id)


# ============================================================
# CREATE / UPDATE ALL LEAVE ALLOCATIONS
# ============================================================

@router.post(
    "",
    response_model=LeaveBalanceBulkResponse,
    status_code=200,
)
def save_leave_balances(
    payload: LeaveBalanceCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_permission(MANAGE)),
):
    return create_or_update_leave_balances(
        db,
        payload,
    )


# ============================================================
# UPDATE SINGLE LEAVE ALLOCATION
# ============================================================

@router.patch(
    "/{balance_id}",
    response_model=LeaveBalanceResponse,
)
def edit_leave_balance(
    balance_id: int,
    payload: LeaveBalanceUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_permission(MANAGE)),
):
    return update_leave_balance(
        db,
        balance_id,
        payload,
    )