"""Add activation state to future attendance policies.

Revision ID: 5b7c9d1e3f4a
Revises: d1f6b8c4e2a5, c7d1e2f3a4b5
Create Date: 2026-10-29
"""
from alembic import op
import sqlalchemy as sa

revision = "5b7c9d1e3f4a"
down_revision = ("d1f6b8c4e2a5", "c7d1e2f3a4b5")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "attendance_policy",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("attendance_policy", "is_active")
