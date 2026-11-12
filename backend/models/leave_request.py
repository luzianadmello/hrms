from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)

from database import Base


class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    __table_args__ = (
        CheckConstraint(
            "end_date >= start_date",
            name="ck_leave_requests_valid_date_range",
        ),
        CheckConstraint(
            "days > 0",
            name="ck_leave_requests_days_positive",
        ),
        CheckConstraint(
            "status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')",
            name="ck_leave_requests_status",
        ),
    )

    leave_id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.employee_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    leave_type_id = Column(
        Integer,
        ForeignKey("leave_types.leave_type_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days = Column(Numeric(5, 2), nullable=False)
    reason = Column(Text, nullable=False)

    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        server_default="PENDING",
        index=True,
    )

    # The existing database stores users.user_id here, not employees.employee_id.
    approved_by = Column(
        Integer,
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
    )

    approved_on = Column(DateTime(timezone=True), nullable=True)
