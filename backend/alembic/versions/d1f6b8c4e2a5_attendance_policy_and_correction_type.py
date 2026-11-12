"""attendance policy table (with a default policy) and attendance.correction_type

Revision ID: d1f6b8c4e2a5
Revises: c9e5a7b3d1f4
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d1f6b8c4e2a5"
down_revision = "c9e5a7b3d1f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ----- why HR touched a row -----
    op.add_column(
        "attendance",
        sa.Column("correction_type", sa.String(length=15), nullable=True),
    )
    op.create_check_constraint(
        "ck_attendance_correction_type",
        "attendance",
        "correction_type IS NULL OR correction_type IN "
        "('MISSED_CHECKOUT', 'WRONG_TIME', 'MANUAL_ENTRY')",
    )

    # ----- the policy table -----
    op.create_table(
        "attendance_policy",
        sa.Column("policy_id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("shift_start", sa.Time(), nullable=False),
        sa.Column("shift_end", sa.Time(), nullable=False),
        sa.Column("grace_in_minutes", sa.Integer(), nullable=False),
        sa.Column("grace_out_minutes", sa.Integer(), nullable=False),
        sa.Column("full_day_hours", sa.Numeric(4, 2), nullable=False),
        sa.Column("half_day_hours", sa.Numeric(4, 2), nullable=False),
        sa.Column("overtime_min_minutes", sa.Integer(), nullable=False),
        sa.Column("overtime_buffer_hours", sa.Numeric(4, 2), nullable=False),
        sa.Column("weekly_offs", postgresql.ARRAY(sa.Integer()), nullable=False),
        sa.Column("created_by", sa.Integer(),
                  sa.ForeignKey("users.user_id"), nullable=True),
        sa.UniqueConstraint("effective_from",
                            name="uq_attendance_policy_effective_from"),
        sa.CheckConstraint("shift_end > shift_start",
                           name="ck_attendance_policy_shift"),
        sa.CheckConstraint(
            "grace_in_minutes >= 0 AND grace_in_minutes <= 180 "
            "AND grace_out_minutes >= 0 AND grace_out_minutes <= 180",
            name="ck_attendance_policy_grace"),
        sa.CheckConstraint(
            "half_day_hours > 0 AND half_day_hours < full_day_hours "
            "AND full_day_hours <= 24",
            name="ck_attendance_policy_hours"),
        sa.CheckConstraint(
            "overtime_min_minutes >= 0 AND overtime_min_minutes <= 240 "
            "AND overtime_buffer_hours >= 0 "
            "AND full_day_hours + overtime_buffer_hours <= 24",
            name="ck_attendance_policy_overtime"),
    )
    op.create_index("ix_attendance_policy_policy_id", "attendance_policy", ["policy_id"])

    # The starting policy. It begins in 2000, so it covers all history:
    # 09:00-17:00, 30 min grace each way, 8h full day, 4h half day,
    # overtime from 30 min, 4h buffer (12h cutoff), Saturday + Sunday off.
    op.execute(
        """
        INSERT INTO attendance_policy (
            name, effective_from, shift_start, shift_end,
            grace_in_minutes, grace_out_minutes,
            full_day_hours, half_day_hours,
            overtime_min_minutes, overtime_buffer_hours, weekly_offs
        )
        VALUES (
            'Default', '2000-01-01', '09:00', '17:00',
            30, 30,
            8.00, 4.00,
            30, 4.00, ARRAY[5, 6]
        )
        """
    )


def downgrade() -> None:
    op.drop_index("ix_attendance_policy_policy_id", table_name="attendance_policy")
    op.drop_table("attendance_policy")
    op.drop_constraint("ck_attendance_correction_type", "attendance", type_="check")
    op.drop_column("attendance", "correction_type")