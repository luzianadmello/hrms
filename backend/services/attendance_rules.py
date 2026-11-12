"""Pure attendance rules: no database, no FastAPI.

Everything that decides "what is this day?" lives here so it can be tested
without a database. The services only load rows and call these.

Hours, overtime, status and flags are never stored. They are worked out from
the check-in and check-out times and the policy in force on that day.
"""
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

# Dates are worked out in India time; times are stored in UTC.
IST = ZoneInfo("Asia/Kolkata")

# An employee can still tap check-out on an open record younger than this.
# (Whether that day counts as a missed check-out is decided by the policy cutoff.)
CHECKOUT_WINDOW = timedelta(hours=24)

# Range limits
MAX_RANGE_DAYS = 31          # /me and the HR grid
MAX_CSV_RANGE_DAYS = 92      # the HR CSV download
REPORT_PAGE_SIZE = 25        # employees per page in the HR grid

# HR corrections
CORRECTION_WINDOW_DAYS = 30  # nothing older than this can be changed
MAX_SHIFT = timedelta(hours=24)

CORRECTION_TYPES = ("MISSED_CHECKOUT", "WRONG_TIME", "MANUAL_ENTRY")
# Audit descriptions used when HR does not type an optional reason.
DEFAULT_REASONS = {
    "MISSED_CHECKOUT": "Missed checkout corrected by HR",
    "WRONG_TIME": "Attendance time corrected by HR",
    "MANUAL_ENTRY": "Attendance entered by HR",
}
DEFAULT_CLEAR_REASON = "Attendance record cleared by HR"
DEFAULT_CORRECTION_REASON = "Attendance corrected by HR"

# Weekday numbers follow Python: Monday = 0 ... Sunday = 6
WEEKDAY_NAMES = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")

# Day statuses
PRESENT = "PRESENT"
HALF_DAY = "HALF_DAY"
ABSENT = "ABSENT"
ACTIVE = "ACTIVE"                    # checked in, still within the policy cutoff
INCOMPLETE = "INCOMPLETE"            # check-out was not recorded
WEEKEND = "WEEKEND"
HOLIDAY = "HOLIDAY"                  # added with the holidays feature
YET_TO_CHECK_IN = "YET_TO_CHECK_IN"

# Flags on a day (a day can have several)
LATE = "LATE"
EARLY_LEAVE = "EARLY_LEAVE"
MISSED_CHECKOUT = "MISSED_CHECKOUT"  # correction type (not a day status)
INCOMPLETE_FLAG = INCOMPLETE

# Banner states for the employee screen
NOT_CHECKED_IN = "NOT_CHECKED_IN"
CHECKED_IN = "CHECKED_IN"
CHECKED_OUT = "CHECKED_OUT"
NON_WORKING = "NON_WORKING"


# ============================================================
# POLICY
# ============================================================

@dataclass(frozen=True)
class Policy:
    """The work rules in force on a given day (one row of attendance_policy)."""

    name: str
    shift_start: time
    shift_end: time
    grace_in_minutes: int
    grace_out_minutes: int
    full_day_hours: float
    half_day_hours: float
    overtime_min_minutes: int
    overtime_buffer_hours: float
    weekly_offs: tuple[int, ...]

    @property
    def full_day_minutes(self) -> int:
        return round(self.full_day_hours * 60)

    @property
    def half_day_minutes(self) -> int:
        return round(self.half_day_hours * 60)

    @property
    def cutoff_minutes(self) -> int:
        """Open longer than this and the check-out counts as missed (8h + 4h = 12h)."""
        return round((self.full_day_hours + self.overtime_buffer_hours) * 60)


# Used only if the attendance_policy table is empty
DEFAULT_POLICY = Policy(
    name="Default",
    shift_start=time(9, 0),
    shift_end=time(17, 0),
    grace_in_minutes=30,
    grace_out_minutes=30,
    full_day_hours=8.0,
    half_day_hours=4.0,
    overtime_min_minutes=30,
    overtime_buffer_hours=4.0,
    weekly_offs=(5, 6),
)


def policy_for(day: date, policies: list[tuple[date, Policy]]) -> Policy:
    """The policy in force on `day`.

    `policies` is a list of (effective_from, policy) sorted oldest first.
    The latest one that has started on or before `day` wins, so a new policy
    never rewrites days that are already in the past.
    """
    if not policies:
        return DEFAULT_POLICY

    chosen = policies[0][1]
    for effective_from, policy in policies:
        if effective_from <= day:
            chosen = policy
        else:
            break
    return chosen


def validate_policy_values(
    shift_start: time,
    shift_end: time,
    grace_in_minutes: int,
    grace_out_minutes: int,
    full_day_hours: float,
    half_day_hours: float,
    overtime_min_minutes: int,
    overtime_buffer_hours: float,
    weekly_offs: list[int],
) -> None:
    """Raise ValueError with a readable message if the numbers make no sense."""
    if shift_end <= shift_start:
        raise ValueError("Shift end must be after shift start")

    if not 0 <= grace_in_minutes <= 180:
        raise ValueError("Late-arrival grace must be between 0 and 180 minutes")

    if not 0 <= grace_out_minutes <= 180:
        raise ValueError("Early-leave grace must be between 0 and 180 minutes")

    shift_minutes = (
        (shift_end.hour * 60 + shift_end.minute)
        - (shift_start.hour * 60 + shift_start.minute)
    )
    if grace_in_minutes + grace_out_minutes >= shift_minutes:
        raise ValueError("The two grace periods must be shorter than the shift")

    if not 0 < full_day_hours <= 24:
        raise ValueError("Full-day hours must be more than 0 and at most 24")

    if not 0 < half_day_hours < full_day_hours:
        raise ValueError("Half-day hours must be more than 0 and less than full-day hours")

    if not 0 <= overtime_min_minutes <= 240:
        raise ValueError("Minimum overtime must be between 0 and 240 minutes")

    if overtime_buffer_hours < 0 or full_day_hours + overtime_buffer_hours > 24:
        raise ValueError(
            "Full-day hours plus the overtime buffer cannot be more than 24"
        )

    if any(d not in range(7) for d in weekly_offs):
        raise ValueError("Weekly offs must be days of the week")

    if len(set(weekly_offs)) >= 7:
        raise ValueError("At least one day of the week must be a working day")


def validate_policy_start(effective_from: date, today: date) -> None:
    """A policy takes effect tomorrow or later, never on a day already lived."""
    if effective_from <= today:
        raise ValueError(
            "A policy must start tomorrow or later, because today and past days "
            "cannot change"
        )


# ============================================================
# TIME HELPERS
# ============================================================

def utc_now() -> datetime:
    """The server clock: the only source of time for attendance."""
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    """Some databases (SQLite) hand back naive datetimes; treat them as UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def from_local(value: datetime) -> datetime:
    """A time typed without a timezone is India time; convert it to UTC."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=IST)
    return value.astimezone(timezone.utc)


def ist_date(moment: datetime) -> date:
    return as_utc(moment).astimezone(IST).date()


# ============================================================
# ONE RECORD -> hours, overtime, status, flags
# ============================================================

def evaluate_record(
    check_in: datetime,
    check_out: datetime | None,
    correction_type: str | None,
    now: datetime,
    policy: Policy,
) -> dict:
    """Judge one attendance record.

    Start: arriving by shift start + grace counts from the shift start (early
    arrival earns nothing). Arriving later counts from the real time and is LATE.

    End: leaving in the last grace window before shift end counts to shift end.
    Leaving earlier counts the real time and is EARLY_LEAVE. Later counts real time.

    Missing check-out after the cutoff is INCOMPLETE: no hours or overtime are
    assumed. HR-entered actual times are evaluated normally.
    """
    ci = as_utc(check_in).astimezone(IST)

    shift_start = datetime.combine(ci.date(), policy.shift_start, tzinfo=IST)
    shift_end = datetime.combine(ci.date(), policy.shift_end, tzinfo=IST)

    late = ci > shift_start + timedelta(minutes=policy.grace_in_minutes)
    counted_from = ci if late else shift_start

    cutoff = timedelta(minutes=policy.cutoff_minutes)

    result = {
        "status": None,
        "minutes": None,
        "overtime": 0,
        "late": late,
        "early": False,
        "missed": False,
    }

    def incomplete() -> dict:
        result["status"] = INCOMPLETE
        result["minutes"] = None
        result["overtime"] = 0
        result["missed"] = True
        return result

    if check_out is None:
        # Judged by time elapsed, not by the calendar date
        if as_utc(now) - as_utc(check_in) <= cutoff:
            result["status"] = ACTIVE
            return result
        return incomplete()

    co = as_utc(check_out).astimezone(IST)

    # A checkout beyond the policy cutoff is not trusted as a normal punch.
    # HR-entered actual times carry a correction type and are evaluated normally.
    if correction_type is None and co - ci > cutoff:
        return incomplete()

    leave_window_start = shift_end - timedelta(minutes=policy.grace_out_minutes)

    result["early"] = co < leave_window_start
    counted_to = shift_end if leave_window_start <= co <= shift_end else co

    minutes = max(0, int((counted_to - counted_from).total_seconds() // 60))

    # Lateness is tracked as a separate flag. If an employee stays through
    # the scheduled shift end, the late arrival alone must not downgrade the
    # attendance day to HALF_DAY.
    completed_shift_after_late_arrival = (
        late and co >= shift_end and minutes >= policy.half_day_minutes
    )

    if minutes >= policy.full_day_minutes or completed_shift_after_late_arrival:
        status = PRESENT
    elif minutes >= policy.half_day_minutes:
        status = HALF_DAY
    else:
        status = ABSENT

    # Grace can protect PRESENT status, but it must never manufacture overtime.
    actual_start = max(ci, shift_start)
    actual_minutes = max(0, int((co - actual_start).total_seconds() // 60))
    extra = actual_minutes - policy.full_day_minutes
    overtime = extra if extra > 0 and extra >= policy.overtime_min_minutes else 0

    result["status"] = status
    result["minutes"] = minutes
    result["overtime"] = overtime
    return result


def day_off_status(day: date, policy: Policy) -> str | None:
    """Return WEEKEND when the current policy marks the day as a weekly off."""
    if day.weekday() in policy.weekly_offs:
        return WEEKEND
    return None


def build_day_cell(
    day: date,
    today: date,
    now: datetime,
    check_in: datetime | None,
    check_out: datetime | None,
    correction_type: str | None,
    policies: list[tuple[date, Policy]],
) -> dict:
    """Everything one day shows, using the policy that was in force that day.

    Callers skip days before the joining date. Inactive employee handling is
    done by the report service because there is no termination date yet.
    status None means a blank cell (a future day).
    """
    policy = policy_for(day, policies)

    cell = {
        "status": None,
        "check_in_time": None,
        "check_out_time": None,
        "worked_minutes": None,
        "overtime_minutes": 0,
        "flags": [],
        "missed_checkout_pending": False,
        "correction_type": correction_type,
    }

    if check_in is None:
        # No record: holiday, then off-day, then today, then a past day
        if day > today:
            cell["status"] = None
        elif day_off_status(day, policy):
            cell["status"] = day_off_status(day, policy)
        elif day == today:
            cell["status"] = YET_TO_CHECK_IN
        else:
            cell["status"] = ABSENT
        return cell

    result = evaluate_record(check_in, check_out, correction_type, now, policy)

    flags = []
    if result["late"]:
        flags.append(LATE)
    if result["early"]:
        flags.append(EARLY_LEAVE)
    # Keep the MISSED_CHECKOUT flag only while the check-out is genuinely missing.
    if result["missed"]:
        flags.append(MISSED_CHECKOUT)

    cell.update({
        "status": result["status"],
        "check_in_time": as_utc(check_in),
        "check_out_time": as_utc(check_out) if check_out else None,
        "worked_minutes": result["minutes"],
        "overtime_minutes": result["overtime"],
        "flags": flags,
        "missed_checkout_pending": result["missed"],
    })
    return cell


def banner_state(
    today: date,
    joining: date,
    has_today_record: bool,
    today_checked_out: bool,
    has_open_session: bool,
    policy: Policy,
) -> str:
    """The employee banner. An open session from last night counts as checked in."""
    if has_today_record:
        return CHECKED_OUT if today_checked_out else CHECKED_IN
    if has_open_session:
        return CHECKED_IN
    if today < joining or day_off_status(today, policy):
        return NON_WORKING
    return NOT_CHECKED_IN


# ============================================================
# HR CORRECTIONS
# ============================================================

def resolve_reason(clear: bool, correction_type: str | None, reason: str | None) -> str:
    """Return an audit description without requiring HR to type a reason.

    A reason may be supplied optionally. If omitted, use a standard description
    so the existing non-null audit column remains populated.
    """
    typed = (reason or "").strip()
    if typed:
        return typed
    if clear:
        return DEFAULT_CLEAR_REASON
    return DEFAULT_REASONS.get(correction_type, DEFAULT_CORRECTION_REASON)


def validate_correction(
    work_date: date,
    joining: date,
    check_in: datetime | None,
    check_out: datetime | None,
    clear: bool,
    correction_type: str | None,
    now: datetime,
) -> None:
    """Raise ValueError with a readable message if a correction breaks a rule.

    check_in and check_out are the values the day will end up with, already
    timezone-aware (see from_local).
    """
    today = ist_date(now)

    if work_date > today:
        raise ValueError("Future dates cannot be changed")

    if work_date < today - timedelta(days=CORRECTION_WINDOW_DAYS):
        raise ValueError(
            f"Days older than {CORRECTION_WINDOW_DAYS} days cannot be changed"
        )

    if work_date < joining:
        raise ValueError("That date is before the employee's joining date")

    if clear:
        return

    if correction_type not in CORRECTION_TYPES:
        raise ValueError(
            "Choose a correction type: " + ", ".join(CORRECTION_TYPES)
        )

    if check_in is None:
        raise ValueError(
            "A check-in time is required, or set clear to true to remove the day"
        )

    check_in = as_utc(check_in)

    if ist_date(check_in) != work_date:
        raise ValueError("The check-in must fall on the selected date (India time)")

    if check_in > now:
        raise ValueError("The check-in cannot be in the future")

    if check_out is not None:
        check_out = as_utc(check_out)

        if check_out <= check_in:
            raise ValueError("The check-out must be after the check-in")

        if check_out > now:
            raise ValueError("The check-out cannot be in the future")

        if check_out - check_in > MAX_SHIFT:
            raise ValueError("A check-out cannot be more than 24 hours after the check-in")