"""create attendance table

Revision ID: a7c3e5f1b9d2
Revises: f2a6c8d0e1b3
"""
from alembic import op
import sqlalchemy as sa

revision = "a7c3e5f1b9d2"
down_revision = "f2a6c8d0e1b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "attendance",
        sa.Column("attendance_id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(),
                  sa.ForeignKey("employees.employee_id"), nullable=False),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("check_in_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("check_out_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("work_mode", sa.String(length=10), nullable=False),
        sa.Column("edited_by", sa.Integer(),
                  sa.ForeignKey("users.user_id"), nullable=True),
        sa.Column("edit_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
        sa.UniqueConstraint("employee_id", "attendance_date",
                            name="uq_attendance_employee_date"),
        sa.CheckConstraint("work_mode IN ('OFFICE', 'REMOTE')",
                           name="ck_attendance_work_mode"),
        sa.CheckConstraint(
            "check_out_time IS NULL OR check_out_time > check_in_time",
            name="ck_attendance_out_after_in"),
    )
    op.create_index("ix_attendance_attendance_id", "attendance", ["attendance_id"])
    op.create_index("ix_attendance_attendance_date", "attendance", ["attendance_date"])


def downgrade() -> None:
    op.drop_index("ix_attendance_attendance_date", table_name="attendance")
    op.drop_index("ix_attendance_attendance_id", table_name="attendance")
    op.drop_table("attendance")