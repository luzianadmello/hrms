"""Create Leave Management and Holiday tables.

Revision ID: 8c2f1a6d9b40
Revises: 7a9c2e4f6b10
Create Date: 2026-11-03

The ``leaves`` table stores annual employee leave balances (calendar year).
Individual applications are stored in ``leave_requests``.
"""
from alembic import op
import sqlalchemy as sa

revision = "8c2f1a6d9b40"
down_revision = "7a9c2e4f6b10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "leave_types",
        sa.Column("leave_type_id", sa.Integer(), primary_key=True),
        sa.Column("leave_type_name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_paid", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("leave_type_name", name="uq_leave_types_name"),
    )
    op.create_index("ix_leave_types_leave_type_id", "leave_types", ["leave_type_id"])

    op.create_table(
        "leaves",
        sa.Column("balance_id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.employee_id", ondelete="CASCADE"), nullable=False),
        sa.Column("leave_type_id", sa.Integer(), sa.ForeignKey("leave_types.leave_type_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("allocated_days", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("used_days", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("remaining_days", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.CheckConstraint("allocated_days >= 0", name="ck_leaves_allocated_nonnegative"),
        sa.CheckConstraint("used_days >= 0", name="ck_leaves_used_nonnegative"),
        sa.CheckConstraint("remaining_days >= 0", name="ck_leaves_remaining_nonnegative"),
        sa.CheckConstraint("used_days <= allocated_days", name="ck_leaves_used_lte_allocated"),
        sa.UniqueConstraint("employee_id", "leave_type_id", "year", name="uq_leaves_employee_type_year"),
    )
    op.create_index("ix_leaves_balance_id", "leaves", ["balance_id"])
    op.create_index("ix_leaves_employee_id", "leaves", ["employee_id"])
    op.create_index("ix_leaves_leave_type_id", "leaves", ["leave_type_id"])

    op.create_table(
        "leave_requests",
        sa.Column("leave_id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.employee_id", ondelete="CASCADE"), nullable=False),
        sa.Column("leave_type_id", sa.Integer(), sa.ForeignKey("leave_types.leave_type_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("days", sa.Numeric(5, 2), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING"),
        sa.Column("approved_by", sa.Integer(), sa.ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_on", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("end_date >= start_date", name="ck_leave_requests_valid_date_range"),
        sa.CheckConstraint("days > 0", name="ck_leave_requests_days_positive"),
        sa.CheckConstraint("status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')", name="ck_leave_requests_status"),
    )
    op.create_index("ix_leave_requests_leave_id", "leave_requests", ["leave_id"])
    op.create_index("ix_leave_requests_employee_id", "leave_requests", ["employee_id"])
    op.create_index("ix_leave_requests_leave_type_id", "leave_requests", ["leave_type_id"])
    op.create_index("ix_leave_requests_status", "leave_requests", ["status"])
    op.create_index("ix_leave_requests_dates", "leave_requests", ["start_date", "end_date"])

    op.create_table(
        "holidays",
        sa.Column("holiday_id", sa.Integer(), primary_key=True),
        sa.Column("holiday_name", sa.String(length=100), nullable=False),
        sa.Column("holiday_date", sa.Date(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("holiday_date", name="uq_holidays_holiday_date"),
    )
    op.create_index("ix_holidays_holiday_id", "holidays", ["holiday_id"])
    op.create_index("ix_holidays_holiday_date", "holidays", ["holiday_date"])


def downgrade() -> None:
    op.drop_index("ix_holidays_holiday_date", table_name="holidays")
    op.drop_index("ix_holidays_holiday_id", table_name="holidays")
    op.drop_table("holidays")

    op.drop_index("ix_leave_requests_dates", table_name="leave_requests")
    op.drop_index("ix_leave_requests_status", table_name="leave_requests")
    op.drop_index("ix_leave_requests_leave_type_id", table_name="leave_requests")
    op.drop_index("ix_leave_requests_employee_id", table_name="leave_requests")
    op.drop_index("ix_leave_requests_leave_id", table_name="leave_requests")
    op.drop_table("leave_requests")

    op.drop_index("ix_leaves_leave_type_id", table_name="leaves")
    op.drop_index("ix_leaves_employee_id", table_name="leaves")
    op.drop_index("ix_leaves_balance_id", table_name="leaves")
    op.drop_table("leaves")

    op.drop_index("ix_leave_types_leave_type_id", table_name="leave_types")
    op.drop_table("leave_types")
