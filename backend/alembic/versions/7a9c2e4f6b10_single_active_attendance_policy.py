"""Enforce a single currently active attendance policy."""
from alembic import op
import sqlalchemy as sa

revision = "7a9c2e4f6b10"
down_revision = "5b7c9d1e3f4a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        WITH chosen AS (
            SELECT policy_id
            FROM attendance_policy
            WHERE effective_from <= CURRENT_DATE
            ORDER BY effective_from DESC, policy_id DESC
            LIMIT 1
        )
        UPDATE attendance_policy
        SET is_active = (
            policy_id = COALESCE(
                (SELECT policy_id FROM chosen),
                (SELECT policy_id FROM attendance_policy
                 ORDER BY effective_from ASC, policy_id ASC LIMIT 1)
            )
        )
    """)
    op.create_index(
        "uq_attendance_policy_single_active",
        "attendance_policy",
        ["is_active"],
        unique=True,
        postgresql_where=sa.text("is_active IS TRUE"),
    )


def downgrade() -> None:
    op.drop_index("uq_attendance_policy_single_active", table_name="attendance_policy")
