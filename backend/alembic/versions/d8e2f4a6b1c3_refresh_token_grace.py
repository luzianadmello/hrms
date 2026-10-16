"""refresh token rotation grace

Revision ID: d8e2f4a6b1c3
Revises: 4ddbcdbf67e1
"""
from alembic import op
import sqlalchemy as sa

revision = "d8e2f4a6b1c3"
down_revision = "4ddbcdbf67e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "refresh_tokens",
        sa.Column("prev_token_hash", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "refresh_tokens",
        sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("refresh_tokens", "rotated_at")
    op.drop_column("refresh_tokens", "prev_token_hash")
