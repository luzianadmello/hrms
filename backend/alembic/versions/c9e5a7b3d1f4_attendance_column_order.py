"""attendance: put employee_code right after attendance_id

Postgres cannot move a column, so the table is rebuilt in the new order and
the rows are copied across. Nothing is lost; if any step fails, the whole
migration rolls back.

Revision ID: c9e5a7b3d1f4
Revises: b8d4f6a2c0e3
"""
from alembic import op
import sqlalchemy as sa

revision = "c9e5a7b3d1f4"
down_revision = "b8d4f6a2c0e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Keep a copy of the rows
    op.execute("CREATE TABLE attendance_backup AS SELECT * FROM attendance")

    # 2. Drop the old table and build it again in the new column order
    op.drop_table("attendance")
    op.create_table(
        "attendance",
        sa.Column("attendance_id", sa.Integer(), primary_key=True),
        sa.Column("employee_code", sa.String(), nullable=False),
        sa.Column("employee_id", sa.Integer(),
                  sa.ForeignKey("employees.employee_id"), nullable=False),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("check_in_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("check_out_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("edited_by", sa.Integer(),
                  sa.ForeignKey("users.user_id"), nullable=True),
        sa.Column("edit_reason", sa.Text(), nullable=True),
        sa.UniqueConstraint("employee_id", "attendance_date",
                            name="uq_attendance_employee_date"),
        sa.CheckConstraint(
            "check_out_time IS NULL OR check_out_time > check_in_time",
            name="ck_attendance_out_after_in"),
    )
    op.create_index("ix_attendance_attendance_id", "attendance", ["attendance_id"])
    op.create_index("ix_attendance_attendance_date", "attendance", ["attendance_date"])

    # 3. Copy the rows back, keeping their ids
    op.execute(
        """
        INSERT INTO attendance (
            attendance_id, employee_code, employee_id, attendance_date,
            check_in_time, check_out_time, edited_by, edit_reason
        )
        SELECT
            attendance_id, employee_code, employee_id, attendance_date,
            check_in_time, check_out_time, edited_by, edit_reason
        FROM attendance_backup
        """
    )

    # 4. Make the id counter continue after the highest copied id
    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('attendance', 'attendance_id'),
            COALESCE(MAX(attendance_id), 1),
            MAX(attendance_id) IS NOT NULL
        )
        FROM attendance
        """
    )

    op.execute("DROP TABLE attendance_backup")


def downgrade() -> None:
    # Column order has no effect on how the app works, so there is nothing to undo.
    pass