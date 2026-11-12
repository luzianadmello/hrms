from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, Numeric, UniqueConstraint

from database import Base


class LeaveBalance(Base):
    __tablename__ = "leaves"
    __table_args__ = (
        UniqueConstraint("employee_id", "leave_type_id", "year", name="uq_leaves_employee_type_year"),
        CheckConstraint("allocated_days >= 0", name="ck_leaves_allocated_nonnegative"),
        CheckConstraint("used_days >= 0", name="ck_leaves_used_nonnegative"),
        CheckConstraint("remaining_days >= 0", name="ck_leaves_remaining_nonnegative"),
        CheckConstraint("used_days <= allocated_days", name="ck_leaves_used_lte_allocated"),
    )

    balance_id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.employee_id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type_id = Column(Integer, ForeignKey("leave_types.leave_type_id", ondelete="RESTRICT"), nullable=False, index=True)
    year = Column(Integer, nullable=False)
    allocated_days = Column(Numeric(5, 2), nullable=False, default=0)
    used_days = Column(Numeric(5, 2), nullable=False, default=0)
    remaining_days = Column(Numeric(5, 2), nullable=False, default=0)
