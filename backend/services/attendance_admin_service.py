"""HR / Admin side of attendance: the report grid, the CSV downloads and corrections."""
import csv
import io
import logging
from datetime import date, timedelta
from math import ceil

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.attendance import Attendance
from models.department import Department
from models.employee import Employee
from models.user import User

from services import attendance_rules as rules
from services.attendance_policy_service import load_policies

audit_log = logging.getLogger("hrms.audit")


def _blank_cell() -> dict:
    """A day that is skipped (before joining) or not here yet."""
    return {
        "status": None,
        "check_in_time": None,
        "check_out_time": None,
        "worked_minutes": None,
        "overtime_minutes": 0,
        "flags": [],
        "missed_checkout_pending": False,
        "correction_type": None,
    }


def _employee_name(first_name: str | None, last_name: str | None, code: str) -> str:
    return " ".join(part for part in (first_name, last_name) if part) or code


def _matching_employees(
    db: Session,
    q: str | None,
    department_id: int | None,
    employee_id: int | None,
):
    """Active employees that match the filters. Inactive employees are skipped."""
    query = (
        db.query(
            Employee.employee_id,
            Employee.employee_code,
            Employee.first_name,
            Employee.last_name,
            Employee.date_of_joining,
            Department.department_name,
        )
        .outerjoin(Department, Department.department_id == Employee.department_id)
        .filter(Employee.status == "ACTIVE")
    )

    if department_id is not None:
        query = query.filter(Employee.department_id == department_id)

    if employee_id is not None:
        query = query.filter(Employee.employee_id == employee_id)

    if q and q.strip():
        safe = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        term = f"%{safe}%"
        full_name = func.concat(
            func.coalesce(Employee.first_name, ""),
            " ",
            func.coalesce(Employee.last_name, ""),
        )
        query = query.filter(
            or_(
                Employee.employee_code.ilike(term, escape="\\"),
                full_name.ilike(term, escape="\\"),
                Employee.email.ilike(term, escape="\\"),
            )
        )

    return query.order_by(Employee.employee_code).all()


def _matches_status(cell: dict, wanted: str | None) -> bool:
    if wanted is None:
        return True
    if wanted == "LATE":
        return rules.LATE in cell["flags"]
    if wanted == "EARLY_LEAVE":
        return rules.EARLY_LEAVE in cell["flags"]
    if wanted in ("INCOMPLETE", "MISSED_CHECKOUT"):
        # Only records whose check-out is genuinely still missing.
        return bool(cell.get("missed_checkout_pending", cell.get("incomplete_pending", False)))
    if wanted == "OVERTIME":
        return cell["overtime_minutes"] > 0
    if wanted == "PRESENT":
        # Same grouping as the summary card: finished days and people still in
        return cell["status"] in (rules.PRESENT, rules.ACTIVE)
    return cell["status"] == wanted


def _summarise(cells, on_date: date) -> dict:
    summary = {
        "date": on_date,
        "total": 0,
        "present": 0,
        "half_day": 0,
        "absent": 0,
        "late": 0,
        "early_leave": 0,
        "missed_checkout": 0,
        "overtime": 0,
        "yet_to_check_in": 0,
        "not_working": 0,
    }

    for cell in cells:
        status = cell["status"]
        if status is None:
            continue

        summary["total"] += 1

        if status in (rules.PRESENT, rules.ACTIVE):
            summary["present"] += 1
        elif status == rules.HALF_DAY:
            summary["half_day"] += 1
        elif status == rules.ABSENT:
            summary["absent"] += 1
        elif status == rules.YET_TO_CHECK_IN:
            summary["yet_to_check_in"] += 1
        elif status in (rules.WEEKEND, rules.HOLIDAY):
            summary["not_working"] += 1

        if rules.LATE in cell["flags"]:
            summary["late"] += 1
        if rules.EARLY_LEAVE in cell["flags"]:
            summary["early_leave"] += 1
        if cell["missed_checkout_pending"]:
            summary["missed_checkout"] += 1
        if cell["overtime_minutes"] > 0:
            summary["overtime"] += 1

    return summary


def _totals(cells) -> dict:
    """One employee's totals over the dates shown."""
    totals = {
        "present_days": 0,
        "half_days": 0,
        "absent_days": 0,
        "late_count": 0,
        "early_leave_count": 0,
        "missed_checkout_count": 0,
        "overtime_minutes": 0,
        "worked_minutes": 0,
    }

    for cell in cells:
        status = cell["status"]
        if status is None:
            continue

        if status == rules.PRESENT:
            totals["present_days"] += 1
        elif status == rules.HALF_DAY:
            totals["half_days"] += 1
        elif status == rules.ABSENT:
            totals["absent_days"] += 1

        if rules.LATE in cell["flags"]:
            totals["late_count"] += 1
        if rules.EARLY_LEAVE in cell["flags"]:
            totals["early_leave_count"] += 1
        # Count incomplete check-outs from the day-status flag.
        if rules.INCOMPLETE_FLAG in cell["flags"]:
            totals["missed_checkout_count"] += 1

        totals["overtime_minutes"] += cell["overtime_minutes"]
        totals["worked_minutes"] += cell["worked_minutes"] or 0

    return totals


# ============================================================
# REPORT
# ============================================================

def build_report(
    db: Session,
    from_date: date | None,
    to_date: date | None,
    on_date: date | None,
    q: str | None,
    department_id: int | None,
    employee_id: int | None,
    status_filter: str | None,
    page: int,
    page_size: int = rules.REPORT_PAGE_SIZE,
    for_csv: bool = False,
) -> dict:
    now = rules.utc_now()
    today = rules.ist_date(now)

    if (from_date is None) != (to_date is None):
        raise HTTPException(
            status_code=422,
            detail="Send both 'from' and 'to', or neither",
        )

    if from_date is None:
        monday = today - timedelta(days=today.weekday())
        from_date, to_date = monday, monday + timedelta(days=6)

    if to_date < from_date:
        raise HTTPException(status_code=422, detail="'to' cannot be before 'from'")

    span = (to_date - from_date).days + 1
    limit = rules.MAX_CSV_RANGE_DAYS if for_csv else rules.MAX_RANGE_DAYS

    if span > limit:
        raise HTTPException(
            status_code=422,
            detail=f"The date range cannot be longer than {limit} days",
        )

    if on_date is None:
        on_date = today

    employees = _matching_employees(db, q, department_id, employee_id)
    policies = load_policies(db)

    def cell_for(day: date, joining: date, record) -> dict:
        if day < joining:
            return _blank_cell()
        cell = rules.build_day_cell(
            day,
            today,
            now,
            record.check_in_time if record else None,
            record.check_out_time if record else None,
            record.correction_type if record else None,
            policies,
        )
        # attendance_rules uses "incomplete_pending"; the report API historically
        # exposes "missed_checkout_pending". Normalize both names at this boundary.
        pending = bool(cell.get("incomplete_pending", cell.get("missed_checkout_pending", False)))
        cell["incomplete_pending"] = pending
        cell["missed_checkout_pending"] = pending
        return cell

    # ----- The day the summary cards and the status filter look at -----
    all_ids = [e.employee_id for e in employees]
    on_records = {}
    if all_ids:
        for record in db.query(Attendance).filter(
            Attendance.attendance_date == on_date,
            Attendance.employee_id.in_(all_ids),
        ):
            on_records[record.employee_id] = record

    on_cells = {
        e.employee_id: cell_for(on_date, e.date_of_joining, on_records.get(e.employee_id))
        for e in employees
    }

    # Daily snapshot remains available for the existing employee-attendance view.
    summary = _summarise(on_cells.values(), on_date)

    # Range analytics are calculated across ALL matching employees, not just the
    # current table page. Weekly offs are excluded from the attendance denominator.
    all_range_records = {}
    if all_ids:
        for record in db.query(Attendance).filter(
            Attendance.employee_id.in_(all_ids),
            Attendance.attendance_date >= from_date,
            Attendance.attendance_date <= to_date,
        ):
            all_range_records[(record.employee_id, record.attendance_date)] = record

    period_summary = {
        "employees": len(employees), "scheduled_days": 0, "present_days": 0,
        "short_days": 0, "no_record_days": 0, "late_count": 0,
        "early_leave_count": 0, "needs_action": 0, "overtime_minutes": 0,
        "worked_minutes": 0, "attendance_rate": 0.0,
    }
    trend_by_day = []
    department_rollup = {}
    report_days = [from_date + timedelta(days=i) for i in range(span)]
    for employee in employees:
        department = employee.department_name or "Unassigned"
        dept = department_rollup.setdefault(department, {
            "department": department, "scheduled_days": 0, "present_days": 0,
            "short_days": 0, "no_record_days": 0, "late_count": 0,
            "needs_action": 0, "attendance_rate": 0.0,
        })
        for day in report_days:
            cell = cell_for(day, employee.date_of_joining, all_range_records.get((employee.employee_id, day)))
            status = cell["status"]
            if status is None or status in (rules.WEEKEND, rules.HOLIDAY):
                continue
            period_summary["scheduled_days"] += 1
            dept["scheduled_days"] += 1
            if status in (rules.PRESENT, rules.ACTIVE):
                period_summary["present_days"] += 1
                dept["present_days"] += 1
            elif status == rules.HALF_DAY:
                period_summary["short_days"] += 1
                dept["short_days"] += 1
            elif status == rules.ABSENT and cell["check_in_time"] is None:
                period_summary["no_record_days"] += 1
                dept["no_record_days"] += 1
            if rules.LATE in cell["flags"]:
                period_summary["late_count"] += 1
                dept["late_count"] += 1
            if rules.EARLY_LEAVE in cell["flags"]:
                period_summary["early_leave_count"] += 1
            if cell["missed_checkout_pending"]:
                period_summary["needs_action"] += 1
                dept["needs_action"] += 1
            period_summary["overtime_minutes"] += cell["overtime_minutes"]
            period_summary["worked_minutes"] += cell["worked_minutes"] or 0

    for department in department_rollup.values():
        denominator = department["scheduled_days"]
        department["attendance_rate"] = round(((department["present_days"] + 0.5 * department["short_days"]) / denominator) * 100, 1) if denominator else 0.0
    denominator = period_summary["scheduled_days"]
    period_summary["attendance_rate"] = round(((period_summary["present_days"] + 0.5 * period_summary["short_days"]) / denominator) * 100, 1) if denominator else 0.0

    for day in report_days:
        scheduled = present = short = late = 0
        for employee in employees:
            cell = cell_for(day, employee.date_of_joining, all_range_records.get((employee.employee_id, day)))
            if cell["status"] is None or cell["status"] in (rules.WEEKEND, rules.HOLIDAY):
                continue
            scheduled += 1
            if cell["status"] in (rules.PRESENT, rules.ACTIVE): present += 1
            elif cell["status"] == rules.HALF_DAY: short += 1
            if rules.LATE in cell["flags"]: late += 1
        trend_by_day.append({
            "date": day,
            "attendance_rate": round(((present + 0.5 * short) / scheduled) * 100, 1) if scheduled else 0.0,
            "present": present, "short_days": short, "late": late,
        })

    selected = [e for e in employees if _matches_status(on_cells[e.employee_id], status_filter)]

    # ----- Paging: 25 employees per page (the CSV gets everyone) -----
    total = len(selected)

    if for_csv:
        page_employees = selected
        page_size = total
        total_pages = 1
        page = 1
    else:
        # Respect the page size requested by the API (validated by the route).
        page_size = max(1, page_size)
        total_pages = max(1, ceil(total / page_size))
        start = (page - 1) * page_size
        page_employees = selected[start:start + page_size]

    # ----- The grid for the employees on this page -----
    days = [from_date + timedelta(days=i) for i in range(span)]

    page_ids = [e.employee_id for e in page_employees]
    records = {}
    if page_ids:
        for record in db.query(Attendance).filter(
            Attendance.employee_id.in_(page_ids),
            Attendance.attendance_date >= from_date,
            Attendance.attendance_date <= to_date,
        ):
            records[(record.employee_id, record.attendance_date)] = record

    rows = []
    for e in page_employees:
        cells = [
            {"date": day, **cell_for(day, e.date_of_joining, records.get((e.employee_id, day)))}
            for day in days
        ]

        rows.append({
            "employee_id": e.employee_id,
            "employee_code": e.employee_code,
            "employee_name": _employee_name(e.first_name, e.last_name, e.employee_code),
            "department_name": e.department_name,
            "cells": cells,
            "totals": _totals(cells),
        })

    return {
        "from_date": from_date,
        "to_date": to_date,
        "today": today,
        "summary": summary,
        "period_summary": period_summary,
        "daily_trend": trend_by_day,
        "department_summary": sorted(department_rollup.values(), key=lambda item: item["department"].lower()),
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "days": days,
        "rows": rows,
    }


# ============================================================
# CSV DOWNLOADS
# ============================================================

def _csv_safe(value: str | None) -> str:
    """Stop spreadsheet apps from running a cell that starts like a formula."""
    text = value or ""
    if text and text[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + text
    return text


def _dmy(value: date) -> str:
    return value.strftime("%d/%m/%Y")


def _clock(moment) -> str:
    if moment is None:
        return ""
    return rules.as_utc(moment).astimezone(rules.IST).strftime("%H:%M")


def _hours(minutes: int | None) -> str:
    if not minutes:
        return ""
    return f"{minutes // 60}:{minutes % 60:02d}"


def report_to_csv(report: dict, kind: str = "daily") -> tuple[str, str]:
    """Build a CSV from a report. Returns (file name, csv text).

    kind "daily": one line per employee per day (hours, overtime, flags).
    kind "totals": one line per employee with the totals for the dates chosen.
    """
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    span = (
        f"{report['from_date'].strftime('%d/%m/%Y')}"
        f"_to_{report['to_date'].strftime('%d/%m/%Y')}"
    )

    if kind == "totals":
        writer.writerow([
            "Employee Code", "Employee Name", "Department", "From", "To",
            "Present Days", "Half Days", "Absent Days", "Late", "Early Leave",
            "Missed Check-outs", "Overtime (H:MM)", "Hours Counted (H:MM)",
        ])
        for row in report["rows"]:
            t = row["totals"]
            writer.writerow([
                _csv_safe(row["employee_code"]),
                _csv_safe(row["employee_name"]),
                _csv_safe(row["department_name"]),
                _dmy(report["from_date"]),
                _dmy(report["to_date"]),
                t["present_days"],
                t["half_days"],
                t["absent_days"],
                t["late_count"],
                t["early_leave_count"],
                t["missed_checkout_count"],
                _hours(t["overtime_minutes"]),
                _hours(t["worked_minutes"]),
            ])
        return f"attendance_totals_{span.replace('/', '-')}.csv", buffer.getvalue()

    writer.writerow([
        "Employee Code", "Employee Name", "Department", "Date", "Day",
        "Status", "Check In", "Check Out", "Hours Counted", "Overtime",
        "Flags", "HR Correction",
    ])

    for row in report["rows"]:
        for cell in row["cells"]:
            if cell["status"] is None:
                continue  # future days and days before joining
            writer.writerow([
                _csv_safe(row["employee_code"]),
                _csv_safe(row["employee_name"]),
                _csv_safe(row["department_name"]),
                _dmy(cell["date"]),
                cell["date"].strftime("%a"),
                cell["status"],
                _clock(cell["check_in_time"]),
                _clock(cell["check_out_time"]),
                _hours(cell["worked_minutes"]),
                _hours(cell["overtime_minutes"]),
                " ".join(cell["flags"]),
                cell["correction_type"] or "",
            ])

    return f"attendance_{span.replace('/', '-')}.csv", buffer.getvalue()


# ============================================================
# HR CORRECTION
# ============================================================

def correct_attendance(
    db: Session,
    hr_user: User,
    employee_id: int,
    work_date: date,
    data,
) -> dict:
    """Create, change or clear one employee's day.

    Only the times that are sent change; the other one stays as it was. So HR
    can fix a missed check-out by sending just the real check-out time.
    """
    employee = db.get(Employee, employee_id)

    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")

    now = rules.utc_now()

    record = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee_id,
            Attendance.attendance_date == work_date,
        )
        .first()
    )

    sent = data.model_fields_set

    if data.clear:
        if data.check_in_time is not None or data.check_out_time is not None:
            raise HTTPException(
                status_code=400, detail="Do not send times when clearing a day"
            )
        check_in = check_out = None
    else:
        if "check_in_time" in sent:
            if data.check_in_time is None:
                raise HTTPException(
                    status_code=400,
                    detail="The check-in cannot be empty. Set clear to true to remove the day.",
                )
            check_in = rules.from_local(data.check_in_time)
        else:
            check_in = rules.as_utc(record.check_in_time) if record else None

        if "check_out_time" in sent:
            check_out = (
                rules.from_local(data.check_out_time) if data.check_out_time else None
            )
        else:
            check_out = (
                rules.as_utc(record.check_out_time)
                if record and record.check_out_time
                else None
            )

    try:
        rules.validate_correction(
            work_date,
            employee.date_of_joining,
            check_in,
            check_out,
            data.clear,
            data.correction_type,
            now,
        )
        reason = rules.resolve_reason(data.clear, data.correction_type, data.reason)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    old = (record.check_in_time, record.check_out_time) if record else (None, None)

    if data.clear:
        if record is None:
            raise HTTPException(
                status_code=404,
                detail="There is no attendance record to clear on that day",
            )
        db.delete(record)
        action = "cleared"
    else:
        if record is None:
            record = Attendance(
                employee_id=employee_id,
                employee_code=employee.employee_code,
                attendance_date=work_date,
            )
            db.add(record)
            action = "created"
        else:
            action = "updated"

        record.check_in_time = check_in
        record.check_out_time = check_out
        record.edited_by = hr_user.user_id
        record.edit_reason = reason
        record.correction_type = data.correction_type

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="That day was changed by someone else. Reload and try again.",
        )

    audit_log.info(
        "attendance correction %s by user_id=%s employee_id=%s date=%s type=%s "
        "old_in=%s old_out=%s new_in=%s new_out=%s reason=%r",
        action, hr_user.user_id, employee_id, work_date, data.correction_type,
        old[0], old[1], check_in, check_out, reason,
    )

    today = rules.ist_date(now)
    cell = rules.build_day_cell(
        work_date,
        today,
        now,
        None if data.clear else check_in,
        None if data.clear else check_out,
        None if data.clear else data.correction_type,
        load_policies(db),
    )

    return {
        "employee_id": employee_id,
        "employee_code": employee.employee_code,
        "date": work_date,
        **cell,
        "edit_reason": reason,
        "cleared": data.clear,
    }