from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from database import Base


class Attendance(Base):
    """One row per employee per day.

    Status, hours, overtime and the late / early-leave / missed-check-out flags
    are NOT stored: they are worked out on every read from the two times and
    the policy in force that day (services/attendance_rules.py).
    Times are UTC; attendance_date is the India (IST) date of the check-in.
    """

    __tablename__ = "attendance"

    attendance_id = Column(Integer, primary_key=True, index=True)

    # Copied from the employee at check-in so the table reads clearly on its own
    employee_code = Column(String, nullable=False)

    employee_id = Column(
        Integer,
        ForeignKey("employees.employee_id"),
        nullable=False,
    )

    attendance_date = Column(Date, nullable=False, index=True)

    check_in_time = Column(DateTime(timezone=True), nullable=False)

    # Empty until check-out. A missing one is never guessed.
    check_out_time = Column(DateTime(timezone=True), nullable=True)

    # Filled only when HR corrects a day
    edited_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    edit_reason = Column(Text, nullable=True)

    # Why HR touched this row. MISSED_CHECKOUT records the correction method;
    # the day is no longer INCOMPLETE once the actual check-out is entered.
    correction_type = Column(String(15), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "employee_id", "attendance_date", name="uq_attendance_employee_date"
        ),
        CheckConstraint(
            "check_out_time IS NULL OR check_out_time > check_in_time",
            name="ck_attendance_out_after_in",
        ),
        CheckConstraint(
            "correction_type IS NULL OR correction_type IN "
            "('MISSED_CHECKOUT', 'WRONG_TIME', 'MANUAL_ENTRY')",
            name="ck_attendance_correction_type",
        ),
    )