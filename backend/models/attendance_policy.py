from sqlalchemy import (
    CheckConstraint,
    Boolean,
    Column,
    Date,
    ForeignKey,
    Integer,
    Index,
    text,
    Numeric,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY

from database import Base


class AttendancePolicy(Base):
    """The attendance rules, with history.

    Policy versions are effective-dated. HR can edit and toggle versions;
    each attendance date uses the latest active policy effective on that date.
    """

    __tablename__ = "attendance_policy"

    policy_id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)

    # The first day this policy applies
    effective_from = Column(Date, nullable=False)

    # Whether this policy version participates in the effective-date timeline.
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    # Shift times, India time
    shift_start = Column(Time, nullable=False)
    shift_end = Column(Time, nullable=False)

    # Arriving up to this long after shift_start still counts from shift_start.
    # Leaving up to this long before shift_end still counts to shift_end.
    grace_in_minutes = Column(Integer, nullable=False)
    grace_out_minutes = Column(Integer, nullable=False)

    # Counted hours for a PRESENT day and for a HALF_DAY
    full_day_hours = Column(Numeric(4, 2), nullable=False)
    half_day_hours = Column(Numeric(4, 2), nullable=False)

    # Overtime is hours beyond full_day_hours, shown only if at least this long
    overtime_min_minutes = Column(Integer, nullable=False)

    # full_day_hours + this = the cutoff after which a missing check-out counts
    # as a missed check-out (8 + 4 = 12 hours)
    overtime_buffer_hours = Column(Numeric(4, 2), nullable=False)

    # Weekdays that are off: Monday = 0 ... Sunday = 6
    weekly_offs = Column(ARRAY(Integer), nullable=False)

    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    __table_args__ = (
        UniqueConstraint("effective_from", name="uq_attendance_policy_effective_from"),
        Index(
            "uq_attendance_policy_single_active",
            "is_active",
            unique=True,
            postgresql_where=text("is_active IS TRUE"),
        ),
        CheckConstraint("shift_end > shift_start", name="ck_attendance_policy_shift"),
        CheckConstraint(
            "grace_in_minutes >= 0 AND grace_in_minutes <= 180 "
            "AND grace_out_minutes >= 0 AND grace_out_minutes <= 180",
            name="ck_attendance_policy_grace",
        ),
        CheckConstraint(
            "half_day_hours > 0 AND half_day_hours < full_day_hours "
            "AND full_day_hours <= 24",
            name="ck_attendance_policy_hours",
        ),
        CheckConstraint(
            "overtime_min_minutes >= 0 AND overtime_min_minutes <= 240 "
            "AND overtime_buffer_hours >= 0 "
            "AND full_day_hours + overtime_buffer_hours <= 24",
            name="ck_attendance_policy_overtime",
        ),
    )