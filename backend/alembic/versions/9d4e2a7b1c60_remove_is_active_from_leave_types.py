"""Remove is_active from leave_types to match the approved ERD.

Revision ID: 9d4e2a7b1c60
Revises: 8c2f1a6d9b40
"""
from alembic import op
import sqlalchemy as sa

revision = "9d4e2a7b1c60"
down_revision = "8c2f1a6d9b40"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("leave_types", "is_active")


def downgrade():
    op.add_column(
        "leave_types",
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )
