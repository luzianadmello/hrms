"""attendance: add employee_code, drop work_mode and created_at

Revision ID: b8d4f6a2c0e3
Revises: a7c3e5f1b9d2
"""
from alembic import op
import sqlalchemy as sa

revision = "b8d4f6a2c0e3"
down_revision = "a7c3e5f1b9d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add as nullable, fill rows that already exist, then make it required
    op.add_column("attendance", sa.Column("employee_code", sa.String(), nullable=True))
    op.execute(
        """
        UPDATE attendance
        SET employee_code = employees.employee_code
        FROM employees
        WHERE employees.employee_id = attendance.employee_id
        """
    )
    op.alter_column("attendance", "employee_code", nullable=False)

    op.drop_constraint("ck_attendance_work_mode", "attendance", type_="check")
    op.drop_column("attendance", "work_mode")
    op.drop_column("attendance", "created_at")


def downgrade() -> None:
    op.add_column(
        "attendance",
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
    )
    op.add_column(
        "attendance",
        sa.Column("work_mode", sa.String(length=10), nullable=False,
                  server_default="OFFICE"),
    )
    op.alter_column("attendance", "work_mode", server_default=None)
    op.create_check_constraint(
        "ck_attendance_work_mode", "attendance",
        "work_mode IN ('OFFICE', 'REMOTE')",
    )
    op.drop_column("attendance", "employee_code")