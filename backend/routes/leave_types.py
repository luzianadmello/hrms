from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from schemas.leave_type import (
    LeaveTypeCreate,
    LeaveTypeListResponse,
    LeaveTypeResponse,
    LeaveTypeUpdate,
)
from services.leave_type_service import (
    create_leave_type,
    delete_leave_type,
    get_leave_type,
    list_leave_types,
    update_leave_type,
)
from utils.dependencies import require_permission

router = APIRouter(prefix="/leave-types", tags=["Leave Types"])

VIEW = "leave_type.view"
MANAGE = "leave_type.manage"


@router.get("", response_model=LeaveTypeListResponse)
def read_leave_types(
    q: str | None = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
    _user=Depends(require_permission(VIEW)),
):
    return list_leave_types(db, q, page, page_size)


@router.get("/{leave_type_id}", response_model=LeaveTypeResponse)
def read_leave_type(
    leave_type_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_permission(VIEW)),
):
    return get_leave_type(db, leave_type_id)


@router.post("", response_model=LeaveTypeResponse, status_code=201)
def add_leave_type(
    payload: LeaveTypeCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_permission(MANAGE)),
):
    return create_leave_type(db, payload)


@router.patch("/{leave_type_id}", response_model=LeaveTypeResponse)
def edit_leave_type(
    leave_type_id: int,
    payload: LeaveTypeUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_permission(MANAGE)),
):
    return update_leave_type(db, leave_type_id, payload)


@router.delete("/{leave_type_id}")
def remove_leave_type(
    leave_type_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_permission(MANAGE)),
):
    return delete_leave_type(db, leave_type_id)
