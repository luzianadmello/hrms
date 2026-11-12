import logging
from datetime import date, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.attendance import Attendance
from models.employee import Employee
from models.holiday import Holiday
from models.leave_request import LeaveRequest
from models.leave_type import LeaveType
from models.user import User

from services import attendance_rules as rules
from services.attendance_policy_service import load_policies

audit_log = logging.getLogger("hrms.audit")


def _get_working_employee(db: Session, user: User) -> Employee:
    """The logged-in person's employee row; must be ACTIVE."""
    if user.employee_id is None:
        raise HTTPException(
            status_code=403,
            detail="This account has no employee profile, so it has no attendance",
        )

    employee = db.get(Employee, user.employee_id)

    if employee is None:
        raise HTTPException(status_code=404, detail="Employee profile not found")

    if employee.status != "ACTIVE":
        raise HTTPException(status_code=403, detail="Employee is not active")

    return employee


def _latest_open(
    db: Session,
    employee_id: int,
    max_age: timedelta,
    now: datetime,
    lock: bool = False,
):
    """The latest record with no check-out that is younger than `max_age`."""
    query = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee_id,
            Attendance.check_out_time.is_(None),
            Attendance.check_in_time >= now - max_age,
        )
        .order_by(Attendance.check_in_time.desc())
    )
    if lock:
        query = query.with_for_update()
    return query.first()


def _active_session(
    db: Session,
    employee_id: int,
    now: datetime,
    policies,
):
    """Return an open session that is still within that day's policy cutoff.

    An open record past its cutoff is stale: it is handled as INCOMPLETE and
    must not block a new check-in.
    """
    record = _latest_open(db, employee_id, rules.CHECKOUT_WINDOW, now)
    if record is None:
        return None

    cutoff = timedelta(
        minutes=rules.policy_for(record.attendance_date, policies).cutoff_minutes
    )
    age = rules.as_utc(now) - rules.as_utc(record.check_in_time)
    return record if age <= cutoff else None


def _record_response(record: Attendance) -> dict:
    return {
        "attendance_date": record.attendance_date,
        "check_in_time": rules.as_utc(record.check_in_time),
        "check_out_time": (
            rules.as_utc(record.check_out_time) if record.check_out_time else None
        ),
    }


# ============================================================
# CHECK IN
# ============================================================

def check_in(db: Session, user: User) -> dict:
    employee = _get_working_employee(db, user)

    now = rules.utc_now()
    today = rules.ist_date(now)

    if today < employee.date_of_joining:
        raise HTTPException(
            status_code=400,
            detail="You cannot check in before your joining date",
        )

    already = (
        db.query(Attendance.attendance_id)
        .filter(
            Attendance.employee_id == employee.employee_id,
            Attendance.attendance_date == today,
        )
        .first()
    )

    if already:
        raise HTTPException(status_code=409, detail="You have already checked in today")

    # Prevent a second check-in while a previous session is still active.
    # Stale sessions past their policy cutoff do not block today's check-in.
    policies = load_policies(db)
    if _active_session(db, employee.employee_id, now, policies) is not None:
        raise HTTPException(
            status_code=409,
            detail="You are still checked in from an earlier session. Check out first.",
        )

    record = Attendance(
        employee_id=employee.employee_id,
        employee_code=employee.employee_code,
        attendance_date=today,
        check_in_time=now,
    )
    db.add(record)

    try:
        db.commit()
    except IntegrityError:
        # Two taps at once: the unique constraint is the backstop
        db.rollback()
        raise HTTPException(status_code=409, detail="You have already checked in today")

    db.refresh(record)

    audit_log.info(
        "attendance check-in employee_id=%s date=%s",
        employee.employee_id, today,
    )

    return _record_response(record)


# ============================================================
# CHECK OUT
# ============================================================

def check_out(db: Session, user: User) -> dict:
    employee = _get_working_employee(db, user)

    now = rules.utc_now()

    record = _latest_open(
        db, employee.employee_id, rules.CHECKOUT_WINDOW, now, lock=True
    )

    if record is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "There is no open check-in to close. If you missed a previous "
                "day's check-out, contact HR to correct that attendance record."
            ),
        )

    # After the policy cutoff, employees cannot self-close the old day. HR must
    # enter the actual checkout time and correction type. Short overnight
    # sessions that are still within the cutoff can still be checked out normally.
    policies = load_policies(db)
    record_policy = rules.policy_for(record.attendance_date, policies)
    age = rules.as_utc(now) - rules.as_utc(record.check_in_time)
    if age > timedelta(minutes=record_policy.cutoff_minutes):
        raise HTTPException(
            status_code=409,
            detail=(
                "This check-in has passed the checkout cutoff and is marked "
                "INCOMPLETE. Please contact HR to enter the actual check-out time and correction type."
            ),
        )

    record.check_out_time = now
    db.commit()
    db.refresh(record)

    audit_log.info(
        "attendance check-out employee_id=%s date=%s",
        employee.employee_id, record.attendance_date,
    )

    return _record_response(record)


# ============================================================
# MY ATTENDANCE (banner + week)
# ============================================================

def _default_week(today: date) -> tuple[date, date]:
    monday = today - timedelta(days=today.weekday())
    return monday, monday + timedelta(days=6)


def get_my_attendance(
    db: Session,
    user: User,
    from_date: date | None,
    to_date: date | None,
) -> dict:
    employee = _get_working_employee(db, user)

    now = rules.utc_now()
    today = rules.ist_date(now)

    if (from_date is None) != (to_date is None):
        raise HTTPException(
            status_code=422,
            detail="Send both 'from' and 'to', or neither",
        )

    if from_date is None:
        from_date, to_date = _default_week(today)

    if to_date < from_date:
        raise HTTPException(status_code=422, detail="'to' cannot be before 'from'")

    if (to_date - from_date).days + 1 > rules.MAX_RANGE_DAYS:
        raise HTTPException(
            status_code=422,
            detail=f"The date range cannot be longer than {rules.MAX_RANGE_DAYS} days",
        )

    yesterday = today - timedelta(days=1)
    correction_window_start = today - timedelta(days=rules.CORRECTION_WINDOW_DAYS)

    # One query covers the range, today, yesterday and the last 30 days
    low = min(from_date, correction_window_start)
    high = max(to_date, today)

    rows = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee.employee_id,
            Attendance.attendance_date >= low,
            Attendance.attendance_date <= high,
        )
        .all()
    )
    by_date = {row.attendance_date: row for row in rows}

    # Each day is judged by the policy that was in force on that day.
    # Approved leave and company holidays are layered into the same personal
    # attendance calendar so employees do not have to switch modules to see them.
    policies = load_policies(db)
    holiday_by_date = {
        row.holiday_date: row.holiday_name
        for row in db.query(Holiday).filter(
            Holiday.holiday_date >= from_date,
            Holiday.holiday_date <= to_date,
        ).all()
    }
    approved_leave_rows = (
        db.query(LeaveRequest, LeaveType.leave_type_name)
        .join(LeaveType, LeaveType.leave_type_id == LeaveRequest.leave_type_id)
        .filter(
            LeaveRequest.employee_id == employee.employee_id,
            LeaveRequest.status == "APPROVED",
            LeaveRequest.start_date <= to_date,
            LeaveRequest.end_date >= from_date,
        )
        .all()
    )
    leave_by_date = {}
    for leave_request, leave_type_name in approved_leave_rows:
        cursor_day = max(from_date, leave_request.start_date)
        last_day = min(to_date, leave_request.end_date)
        while cursor_day <= last_day:
            policy_for_day = rules.policy_for(cursor_day, policies)
            if cursor_day not in holiday_by_date and cursor_day.weekday() not in policy_for_day.weekly_offs:
                leave_by_date[cursor_day] = {
                    "leave_type_name": leave_type_name,
                    "leave_days": float(leave_request.days) if leave_request.start_date == leave_request.end_date else None,
                }
            cursor_day += timedelta(days=1)

    def cell_for(day: date) -> dict:
        record = by_date.get(day)
        cell = rules.build_day_cell(
            day,
            today,
            now,
            record.check_in_time if record else None,
            record.check_out_time if record else None,
            record.correction_type if record else None,
            policies,
        )
        if record is None:
            if day in holiday_by_date:
                cell["status"] = "HOLIDAY"
                cell["holiday_name"] = holiday_by_date[day]
            elif day in leave_by_date:
                cell["status"] = "LEAVE"
                cell.update(leave_by_date[day])
        return cell

    days = []
    cursor = from_date
    while cursor <= to_date:
        # Days before the joining date are skipped, not shown as absent
        if cursor >= employee.date_of_joining:
            cell = cell_for(cursor)
            days.append({
                "date": cursor,
                "weekday": cursor.strftime("%a"),
                "status": cell["status"],
                "check_in_time": cell["check_in_time"],
                "check_out_time": cell["check_out_time"],
                "worked_minutes": cell["worked_minutes"],
                "overtime_minutes": cell["overtime_minutes"],
                "flags": cell["flags"],
                "correction_type": cell["correction_type"],
                "leave_type_name": cell.get("leave_type_name"),
                "leave_days": cell.get("leave_days"),
                "holiday_name": cell.get("holiday_name"),
            })
        cursor += timedelta(days=1)

    # Days with a check-out still missing, which HR can still fix
    missed_dates = sorted(
        row.attendance_date
        for row in rows
        if row.check_out_time is None
        and row.attendance_date >= correction_window_start
        and cell_for(row.attendance_date)["missed_checkout_pending"]
    )

    # Only an open session still within its own day's policy cutoff is treated
    # as an active session. A stale previous day is INCOMPLETE and never blocks
    # today's check-in; HR must correct that old day.
    open_sessions = [
        (row, rules.as_utc(now) - rules.as_utc(row.check_in_time))
        for row in rows
        if row.check_out_time is None
    ]
    has_open_session = any(
        age <= timedelta(minutes=rules.policy_for(row.attendance_date, policies).cutoff_minutes)
        for row, age in open_sessions
    )
    can_check_out = any(
        age <= timedelta(minutes=rules.policy_for(row.attendance_date, policies).cutoff_minutes)
        and age <= rules.CHECKOUT_WINDOW
        for row, age in open_sessions
    )

    today_record = by_date.get(today)
    policy_today = rules.policy_for(today, policies)

    return {
        "server_time": now,
        "today": today,
        "state": rules.banner_state(
            today,
            employee.date_of_joining,
            today_record is not None,
            today_record is not None and today_record.check_out_time is not None,
            has_open_session,
            policy_today,
        ),
        "can_check_in": (
            today_record is None
            and not has_open_session
            and today >= employee.date_of_joining
        ),
        "can_check_out": can_check_out,
        "yesterday_checkout_missing": yesterday in missed_dates,
        "missed_checkout_dates": missed_dates,
        "days": days,
    }