import logging
from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.attendance_policy import AttendancePolicy
from models.user import User

from services import attendance_rules as rules

audit_log = logging.getLogger("hrms.audit")


def _is_default_policy(row: AttendancePolicy) -> bool:
    return row.effective_from == date(2000, 1, 1) or row.name.strip().lower() == "default"


def _to_policy(row: AttendancePolicy) -> rules.Policy:
    return rules.Policy(
        name=row.name,
        shift_start=row.shift_start,
        shift_end=row.shift_end,
        grace_in_minutes=row.grace_in_minutes,
        grace_out_minutes=row.grace_out_minutes,
        full_day_hours=float(row.full_day_hours),
        half_day_hours=float(row.half_day_hours),
        overtime_min_minutes=row.overtime_min_minutes,
        overtime_buffer_hours=float(row.overtime_buffer_hours),
        weekly_offs=tuple(sorted(row.weekly_offs)),
    )


def _sync_current_policy(db: Session) -> list[AttendancePolicy]:
    """Keep exactly one row active: latest policy effective today (India time)."""
    today = rules.ist_date(rules.utc_now())
    rows = (
        db.query(AttendancePolicy)
        .order_by(AttendancePolicy.effective_from.asc(), AttendancePolicy.policy_id.asc())
        .all()
    )
    if not rows:
        return []
    started = [row for row in rows if row.effective_from <= today]
    current = started[-1] if started else rows[0]
    if any(row.is_active != (row.policy_id == current.policy_id) for row in rows):
        db.query(AttendancePolicy).filter(
            AttendancePolicy.is_active.is_(True)
        ).update({AttendancePolicy.is_active: False}, synchronize_session=False)
        db.flush()
        current.is_active = True
        db.commit()
        rows = (
            db.query(AttendancePolicy)
            .order_by(AttendancePolicy.effective_from.asc(), AttendancePolicy.policy_id.asc())
            .all()
        )
    return rows


def load_policies(db: Session) -> list[tuple[date, rules.Policy]]:
    """Load every policy version, including past versions, for date-based calculations."""
    rows = _sync_current_policy(db)
    return [(row.effective_from, _to_policy(row)) for row in rows]


def _row_response(row: AttendancePolicy, status: str) -> dict:
    return {
        "policy_id": row.policy_id,
        "name": row.name,
        "effective_from": row.effective_from,
        "status": status,
        "is_active": row.is_active,
        "shift_start": row.shift_start.strftime("%H:%M"),
        "shift_end": row.shift_end.strftime("%H:%M"),
        "grace_in_minutes": row.grace_in_minutes,
        "grace_out_minutes": row.grace_out_minutes,
        "full_day_hours": float(row.full_day_hours),
        "half_day_hours": float(row.half_day_hours),
        "overtime_min_minutes": row.overtime_min_minutes,
        "overtime_buffer_hours": float(row.overtime_buffer_hours),
        "weekly_offs": [rules.WEEKDAY_NAMES[d] for d in sorted(row.weekly_offs)],
    }


def get_policy_overview(db: Session) -> dict:
    """Return the one policy effective today, scheduled versions and past versions."""
    today = rules.ist_date(rules.utc_now())
    rows = _sync_current_policy(db)
    if not rows:
        raise HTTPException(
            status_code=500,
            detail="No attendance policy is set up. Run the database migrations.",
        )
    started = [row for row in rows if row.effective_from <= today]
    current = started[-1] if started else rows[0]
    upcoming = [_row_response(row, "UPCOMING") for row in rows if row.effective_from > today]
    past = [
        _row_response(row, "PAST")
        for row in reversed(rows)
        if row.policy_id != current.policy_id and row.effective_from <= today
    ]
    return {
        "today": today,
        "current": _row_response(current, "CURRENT"),
        "upcoming": upcoming,
        "past": past,
        "inactive": [],
    }


def save_policy(db: Session, user: User, data) -> dict:
    """Add a policy that starts tomorrow or later.

    A started policy is never edited. If a policy that has not started yet
    already begins on the same day, it is replaced.
    """
    today = rules.ist_date(rules.utc_now())
    effective_from = data.effective_from

    weekly_offs = sorted({rules.WEEKDAY_NAMES.index(name) for name in data.weekly_offs})

    try:
        rules.validate_policy_start(effective_from, today)
        rules.validate_policy_values(
            data.shift_start,
            data.shift_end,
            data.grace_in_minutes,
            data.grace_out_minutes,
            data.full_day_hours,
            data.half_day_hours,
            data.overtime_min_minutes,
            data.overtime_buffer_hours,
            weekly_offs,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    row = (
        db.query(AttendancePolicy)
        .filter(AttendancePolicy.effective_from == effective_from)
        .first()
    )

    if row is None:
        row = AttendancePolicy(effective_from=effective_from)
        db.add(row)

    row.is_active = False
    row.name = (data.name or "").strip() or (
        f"Policy from {effective_from.strftime('%d/%m/%Y')}"
    )
    row.shift_start = data.shift_start.replace(second=0, microsecond=0)
    row.shift_end = data.shift_end.replace(second=0, microsecond=0)
    row.grace_in_minutes = data.grace_in_minutes
    row.grace_out_minutes = data.grace_out_minutes
    row.full_day_hours = round(data.full_day_hours, 2)
    row.half_day_hours = round(data.half_day_hours, 2)
    row.overtime_min_minutes = data.overtime_min_minutes
    row.overtime_buffer_hours = round(data.overtime_buffer_hours, 2)
    row.weekly_offs = weekly_offs
    row.created_by = user.user_id

    db.commit()

    audit_log.info(
        "attendance policy saved by user_id=%s effective_from=%s",
        user.user_id, effective_from,
    )

    return get_policy_overview(db)


def update_policy(db: Session, user: User, policy_id: int, data) -> dict:
    """Partially update an existing policy version without creating a duplicate."""
    row = db.get(AttendancePolicy, policy_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Attendance policy not found")

    is_default = _is_default_policy(row)
    new_effective = data.effective_from or row.effective_from
    today = rules.ist_date(rules.utc_now())

    # Never allow an edit to move the system Default away from its anchor date.
    if is_default:
        new_effective = row.effective_from

    if row.is_active and new_effective > today:
        another_started = db.query(AttendancePolicy).filter(
            AttendancePolicy.is_active.is_(True),
            AttendancePolicy.effective_from <= today,
            AttendancePolicy.policy_id != policy_id,
        ).count()
        if another_started < 1:
            raise HTTPException(
                status_code=409,
                detail="Another active policy must cover today before moving this policy into the future.",
            )

    conflict = db.query(AttendancePolicy).filter(
        AttendancePolicy.effective_from == new_effective,
        AttendancePolicy.policy_id != policy_id,
    ).first()
    if conflict:
        raise HTTPException(
            status_code=409,
            detail="Another policy already has this effective date. Choose a different date.",
        )

    shift_start = data.shift_start or row.shift_start
    shift_end = data.shift_end or row.shift_end
    grace_in = row.grace_in_minutes if data.grace_in_minutes is None else data.grace_in_minutes
    grace_out = row.grace_out_minutes if data.grace_out_minutes is None else data.grace_out_minutes
    full_day = row.full_day_hours if data.full_day_hours is None else data.full_day_hours
    half_day = row.half_day_hours if data.half_day_hours is None else data.half_day_hours
    overtime_min = row.overtime_min_minutes if data.overtime_min_minutes is None else data.overtime_min_minutes
    overtime_buffer = row.overtime_buffer_hours if data.overtime_buffer_hours is None else data.overtime_buffer_hours

    if data.weekly_offs is None:
        weekly_offs = list(row.weekly_offs or [])
    else:
        weekly_offs = sorted({rules.WEEKDAY_NAMES.index(name) for name in data.weekly_offs})

    try:
        rules.validate_policy_values(
            shift_start, shift_end, grace_in, grace_out,
            float(full_day), float(half_day), overtime_min,
            float(overtime_buffer), weekly_offs,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if data.name is not None and not is_default:
        row.name = data.name.strip() or row.name
    row.effective_from = new_effective
    row.shift_start = shift_start.replace(second=0, microsecond=0)
    row.shift_end = shift_end.replace(second=0, microsecond=0)
    row.grace_in_minutes = grace_in
    row.grace_out_minutes = grace_out
    row.full_day_hours = round(float(full_day), 2)
    row.half_day_hours = round(float(half_day), 2)
    row.overtime_min_minutes = overtime_min
    row.overtime_buffer_hours = round(float(overtime_buffer), 2)
    row.weekly_offs = weekly_offs
    row.created_by = user.user_id

    db.commit()
    audit_log.info(
        "attendance policy updated by user_id=%s policy_id=%s effective_from=%s",
        user.user_id, policy_id, new_effective,
    )
    return get_policy_overview(db)


def set_policy_active(
    db: Session, user: User, policy_id: int, is_active: bool, effective_from: date | None = None
) -> dict:
    """Schedule a version for a future date; the current policy remains the sole active row."""
    row = db.get(AttendancePolicy, policy_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Attendance policy not found")
    today = rules.ist_date(rules.utc_now())
    _sync_current_policy(db)
    if not is_active:
        if row.is_active:
            raise HTTPException(
                status_code=409,
                detail="The policy currently in force cannot be deactivated directly. Schedule a replacement policy instead.",
            )
        return get_policy_overview(db)
    if effective_from is None:
        raise HTTPException(status_code=422, detail="Choose the date from which this policy should become active.")
    try:
        rules.validate_policy_start(effective_from, today)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    conflict = db.query(AttendancePolicy).filter(
        AttendancePolicy.effective_from == effective_from,
        AttendancePolicy.policy_id != policy_id,
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="Another policy already has this effective date. Choose a different date.")
    row.effective_from = effective_from
    row.is_active = False
    db.commit()
    audit_log.info(
        "attendance policy scheduled by user_id=%s policy_id=%s effective_from=%s",
        user.user_id, policy_id, row.effective_from,
    )
    return get_policy_overview(db)


def delete_policy(db: Session, user: User, policy_id: int) -> dict:
    """Delete any non-default policy version."""
    row = db.get(AttendancePolicy, policy_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Attendance policy not found")
    if _is_default_policy(row):
        raise HTTPException(status_code=409, detail="The Default policy cannot be deleted.")
    db.delete(row)
    db.commit()
    audit_log.info("attendance policy deleted by user_id=%s policy_id=%s", user.user_id, policy_id)
    return get_policy_overview(db)
