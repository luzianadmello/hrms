"""two employee statuses: Active and Inactive

Revision ID: e1f3a5b7c9d0
Revises: d8e2f4a6b1c3
"""
from alembic import op

revision = "e1f3a5b7c9d0"
down_revision = "d8e2f4a6b1c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ONBOARDING no longer exists; those people can log in, so they are Active
    op.execute("UPDATE employees SET status = 'ACTIVE' WHERE status = 'ONBOARDING'")


def downgrade() -> None:
    pass
