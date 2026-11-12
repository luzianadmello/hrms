from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from database import get_db
from models.user import User

from schemas.attendance import (
    AttendanceCorrectionRequest,
    AttendanceRecordResponse,
    AttendanceReportResponse,
    CorrectionResponse,
    MyAttendanceResponse,
    PolicyOverviewResponse,
    PolicyUpdateRequest,
    PolicyEditRequest,
)

from services.attendance_admin_service import (
    build_report,
    correct_attendance,
    report_to_csv,
)
from services.attendance_policy_service import (
    get_policy_overview,
    save_policy,
    update_policy,
    set_policy_active,
    delete_policy,
)
from services.attendance_service import (
    check_in,
    check_out,
    get_my_attendance,
)

from utils.dependencies import require_permission


router = APIRouter(prefix="/attendance", tags=["Attendance"])

MARK = "attendance.mark"
VIEW_OWN = "attendance.view_own"
VIEW_ALL = "attendance.view_all"
CORRECT = "attendance.correct"
VIEW_POLICY = "attendance.view_policy"
UPDATE_POLICY = "attendance.update_policy"


@router.get("/me", response_model=MyAttendanceResponse)
def my_attendance(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(VIEW_OWN)),
):
    return get_my_attendance(db, current_user, from_date, to_date)


@router.post("/check-in", response_model=AttendanceRecordResponse, status_code=201)
def attendance_check_in(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(MARK)),
):
    return check_in(db, current_user)


@router.post("/check-out", response_model=AttendanceRecordResponse)
def attendance_check_out(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(MARK)),
):
    return check_out(db, current_user)


@router.get("/settings", response_model=PolicyOverviewResponse)
def read_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(VIEW_POLICY)),
):
    return get_policy_overview(db)


@router.put("/settings", response_model=PolicyOverviewResponse)
def update_settings(
    data: PolicyUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(UPDATE_POLICY)),
):
    return save_policy(db, current_user, data)


@router.put("/settings/{policy_id}", response_model=PolicyOverviewResponse)
@router.patch("/settings/{policy_id}", response_model=PolicyOverviewResponse)
def edit_policy(
    policy_id: int,
    data: PolicyEditRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(UPDATE_POLICY)),
):
    return update_policy(db, current_user, policy_id, data)


@router.put("/settings/{policy_id}/status", response_model=PolicyOverviewResponse)
@router.patch("/settings/{policy_id}/status", response_model=PolicyOverviewResponse)
def update_policy_status(
    policy_id: int,
    is_active: bool = Query(...),
    effective_from: date | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(UPDATE_POLICY)),
):
    return set_policy_active(db, current_user, policy_id, is_active, effective_from)


@router.delete("/settings/{policy_id}", response_model=PolicyOverviewResponse)
def remove_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(UPDATE_POLICY)),
):
    return delete_policy(db, current_user, policy_id)


@router.get("/report", response_model=AttendanceReportResponse)
def attendance_report(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    report_date: date | None = Query(None, alias="date"),
    q: str | None = Query(None, max_length=100),
    department_id: int | None = Query(None),
    employee_id: int | None = Query(None),
    status_filter: Literal[
        "PRESENT", "HALF_DAY", "ABSENT", "INCOMPLETE", "LATE", "EARLY_LEAVE",
        "OVERTIME", "YET_TO_CHECK_IN", "WEEKEND",
    ] | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=1000),
    output_format: Literal["json", "csv", "totals_csv"] = Query("json", alias="format"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(VIEW_ALL)),
):
    report = build_report(
        db=db,
        from_date=from_date,
        to_date=to_date,
        on_date=report_date,
        q=q,
        department_id=department_id,
        employee_id=employee_id,
        status_filter=status_filter,
        page=page,
        page_size=page_size,
        for_csv=output_format != "json",
    )

    if output_format != "json":
        file_name, csv_text = report_to_csv(
            report, "totals" if output_format == "totals_csv" else "daily"
        )
        return Response(
            content=("\ufeff" + csv_text).encode("utf-8"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
        )

    return report


@router.put("/{employee_id}/{work_date}", response_model=CorrectionResponse)
def correct_day(
    employee_id: int,
    work_date: date,
    data: AttendanceCorrectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(CORRECT)),
):
    return correct_attendance(db, current_user, employee_id, work_date, data)
