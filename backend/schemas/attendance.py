from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field

DayStatus = Literal[
    "PRESENT", "HALF_DAY", "ABSENT", "ACTIVE", "INCOMPLETE",
    "WEEKEND", "HOLIDAY", "LEAVE", "YET_TO_CHECK_IN",
]

DayFlag = Literal["LATE", "EARLY_LEAVE", "MISSED_CHECKOUT"]

CorrectionType = Literal["MISSED_CHECKOUT", "WRONG_TIME", "MANUAL_ENTRY"]

WeekdayName = Literal["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]


# ============================================================
# EMPLOYEE: check-in, check-out, my week
# ============================================================

class AttendanceRecordResponse(BaseModel):
    attendance_date: date
    check_in_time: datetime
    check_out_time: datetime | None = None


class AttendanceDayResponse(BaseModel):
    date: date
    weekday: str
    # None means a blank cell (a future day)
    status: DayStatus | None = None
    check_in_time: datetime | None = None
    check_out_time: datetime | None = None
    # Hours counted for the day after applying the attendance policy.
    worked_minutes: int | None = None
    # Counted beyond the full day, shown only from the policy's minimum
    overtime_minutes: int = 0
    flags: list[DayFlag] = []
    correction_type: CorrectionType | None = None
    leave_type_name: str | None = None
    leave_days: float | None = None
    holiday_name: str | None = None


class MyAttendanceResponse(BaseModel):
    # Server time, so the screen never trusts the browser clock
    server_time: datetime
    today: date
    state: Literal["NOT_CHECKED_IN", "CHECKED_IN", "CHECKED_OUT", "NON_WORKING"]
    can_check_in: bool
    can_check_out: bool
    # True when yesterday was left open past the cutoff
    yesterday_checkout_missing: bool
    # Days in the last 30 that still have a missing check-out (HR can still fix them)
    missed_checkout_dates: list[date]
    days: list[AttendanceDayResponse]


# ============================================================
# HR: settings (the attendance policy)
# ============================================================

class PolicyUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    # Leave empty to start tomorrow. It can never be today or in the past.
    effective_from: date | None = None
    shift_start: time
    shift_end: time
    grace_in_minutes: int = Field(ge=0, le=180)
    grace_out_minutes: int = Field(ge=0, le=180)
    full_day_hours: float = Field(gt=0, le=24)
    half_day_hours: float = Field(gt=0, le=24)
    overtime_min_minutes: int = Field(ge=0, le=240)
    overtime_buffer_hours: float = Field(ge=0, le=24)
    weekly_offs: list[WeekdayName]


class PolicyEditRequest(BaseModel):
    """Partial update schema for an existing policy version.

    Fields omitted by the client retain their existing database values.
    """
    name: str | None = Field(default=None, max_length=100)
    effective_from: date | None = None
    shift_start: time | None = None
    shift_end: time | None = None
    grace_in_minutes: int | None = Field(default=None, ge=0, le=180)
    grace_out_minutes: int | None = Field(default=None, ge=0, le=180)
    full_day_hours: float | None = Field(default=None, gt=0, le=24)
    half_day_hours: float | None = Field(default=None, gt=0, le=24)
    overtime_min_minutes: int | None = Field(default=None, ge=0, le=240)
    overtime_buffer_hours: float | None = Field(default=None, ge=0, le=24)
    weekly_offs: list[WeekdayName] | None = None


class PolicyStatusRequest(BaseModel):
    is_active: bool
    effective_from: date | None = None


class PolicyResponse(BaseModel):
    policy_id: int
    name: str
    effective_from: date
    status: Literal["PAST", "CURRENT", "UPCOMING", "INACTIVE"]
    is_active: bool
    shift_start: str
    shift_end: str
    grace_in_minutes: int
    grace_out_minutes: int
    full_day_hours: float
    half_day_hours: float
    overtime_min_minutes: int
    overtime_buffer_hours: float
    weekly_offs: list[WeekdayName]


class PolicyOverviewResponse(BaseModel):
    today: date
    current: PolicyResponse
    upcoming: list[PolicyResponse]
    past: list[PolicyResponse]
    inactive: list[PolicyResponse] = []


# ============================================================
# HR: report (grid + summary cards + totals)
# ============================================================

class ReportCell(BaseModel):
    date: date
    status: DayStatus | None = None
    check_in_time: datetime | None = None
    check_out_time: datetime | None = None
    worked_minutes: int | None = None
    overtime_minutes: int = 0
    flags: list[DayFlag] = []
    # True while the check-out is still missing (not yet corrected by HR)
    missed_checkout_pending: bool = False
    correction_type: CorrectionType | None = None


class ReportTotals(BaseModel):
    """Over the dates shown. Pick a whole month to get the monthly totals."""
    present_days: int
    half_days: int
    absent_days: int
    late_count: int
    early_leave_count: int
    # Includes days HR has already fixed, so the count does not shrink
    missed_checkout_count: int
    overtime_minutes: int
    worked_minutes: int


class ReportRow(BaseModel):
    employee_id: int
    employee_code: str
    employee_name: str
    department_name: str | None = None
    cells: list[ReportCell]
    totals: ReportTotals


class ReportSummary(BaseModel):
    # The day the cards describe
    date: date
    # Employees counted that day (active, already joined)
    total: int
    # PRESENT plus people still checked in
    present: int
    half_day: int
    absent: int
    late: int
    early_leave: int
    # Check-outs still missing (not yet corrected by HR)
    missed_checkout: int
    # People with overtime
    overtime: int
    yet_to_check_in: int
    # Weekend or holiday
    not_working: int


class PeriodReportSummary(BaseModel):
    employees: int
    scheduled_days: int
    present_days: int
    short_days: int
    no_record_days: int
    late_count: int
    early_leave_count: int
    needs_action: int
    overtime_minutes: int
    worked_minutes: int
    attendance_rate: float


class DailyAttendanceTrend(BaseModel):
    date: date
    attendance_rate: float
    present: int
    short_days: int
    late: int


class DepartmentAttendanceSummary(BaseModel):
    department: str
    scheduled_days: int
    present_days: int
    short_days: int
    no_record_days: int
    late_count: int
    needs_action: int
    attendance_rate: float


class AttendanceReportResponse(BaseModel):
    from_date: date
    to_date: date
    today: date
    summary: ReportSummary
    period_summary: PeriodReportSummary
    daily_trend: list[DailyAttendanceTrend]
    department_summary: list[DepartmentAttendanceSummary]
    page: int
    page_size: int
    total: int
    total_pages: int
    days: list[date]
    rows: list[ReportRow]


# ============================================================
# HR: correction
# ============================================================

class AttendanceCorrectionRequest(BaseModel):
    """Only send what changes.

    Send check_out_time alone to fix a missed check-out (the check-in stays).
    Send check_out_time as null to remove a wrong check-out (the check-in stays).
    Send both to create a day or change both times.
    Times without a timezone are read as India time.
    """
    check_in_time: datetime | None = None
    check_out_time: datetime | None = None
    # Set true (with no times) to remove the whole day's record.
    clear: bool = False
    # Required unless clear is true
    correction_type: CorrectionType | None = None
    # Optional audit note; the backend supplies a standard description if omitted.
    reason: str | None = Field(default=None, max_length=500)


class CorrectionResponse(BaseModel):
    employee_id: int
    employee_code: str
    date: date
    status: DayStatus | None = None
    check_in_time: datetime | None = None
    check_out_time: datetime | None = None
    worked_minutes: int | None = None
    overtime_minutes: int = 0
    flags: list[DayFlag] = []
    missed_checkout_pending: bool = False
    correction_type: CorrectionType | None = None
    edit_reason: str
    cleared: bool = False