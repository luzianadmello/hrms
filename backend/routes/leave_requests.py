from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from schemas.leave_request import (
    LeaveRequestCreate,
    LeaveRequestListResponse,
    LeaveRequestResponse,
    LeaveRequestReview,
)
from services.leave_request_service import (
    create_leave_request,
    list_all_leave_requests,
    list_my_leave_requests,
    list_team_leave_requests,
    review_leave_request,
    delete_own_pending_leave_request,
)
from utils.dependencies import require_permission


router = APIRouter(prefix="/leave-requests", tags=["Leave Requests"])

VIEW_ALL = "leave_request.view_all"
VIEW_TEAM = "leave_request.view_team"
VIEW_OWN = "leave_request.view_own"
APPLY = "leave_request.apply"
REVIEW = "leave_request.review"
CANCEL = "leave_request.cancel"


def _require_employee_profile(current_user: User) -> int:
    if current_user.employee_id is None:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your user account is not linked to an employee profile.",
        )
    return current_user.employee_id


@router.post("", response_model=LeaveRequestResponse, status_code=201)
def apply_for_leave(
    data: LeaveRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(APPLY)),
):
    return create_leave_request(db, _require_employee_profile(current_user), data)


@router.get("/me", response_model=LeaveRequestListResponse)
def my_leave_requests(
    status_filter: Literal["PENDING", "APPROVED", "REJECTED", "CANCELLED"] | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(VIEW_OWN)),
):
    return list_my_leave_requests(
        db, _require_employee_profile(current_user),
        status=status_filter, page=page, page_size=page_size,
    )


@router.get("/team", response_model=LeaveRequestListResponse)
def team_leave_requests(
    status_filter: Literal["PENDING", "APPROVED", "REJECTED", "CANCELLED"] | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(VIEW_TEAM)),
):
    return list_team_leave_requests(
        db, _require_employee_profile(current_user),
        status=status_filter, page=page, page_size=page_size,
    )


@router.get("", response_model=LeaveRequestListResponse)
def all_leave_requests(
    employee_id: int | None = Query(None, gt=0),
    status_filter: Literal["PENDING", "APPROVED", "REJECTED", "CANCELLED"] | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(VIEW_ALL)),
):
    return list_all_leave_requests(
        db, employee_id=employee_id, status=status_filter, page=page, page_size=page_size,
    )


@router.patch("/{leave_id}/review", response_model=LeaveRequestResponse)
def review_request(
    leave_id: int,
    data: LeaveRequestReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(REVIEW)),
):
    return review_leave_request(
        db=db,
        leave_id=leave_id,
        reviewer_user_id=current_user.user_id,
        reviewer_employee_id=current_user.employee_id,
        decision=data.status,
    )


@router.delete("/{leave_id}", status_code=204)
def delete_leave_request(
    leave_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(CANCEL)),
):
    delete_own_pending_leave_request(
        db, leave_id, _require_employee_profile(current_user)
    )
    return None
