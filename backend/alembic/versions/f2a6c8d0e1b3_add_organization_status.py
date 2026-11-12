"""Add active status to departments and designations."""
from alembic import op
import sqlalchemy as sa

revision = "f2a6c8d0e1b3"
down_revision = "e1f3a5b7c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("departments", sa.Column("status", sa.String(length=10), server_default="ACTIVE", nullable=False))
    op.add_column("designations", sa.Column("status", sa.String(length=10), server_default="ACTIVE", nullable=False))


def downgrade() -> None:
    op.drop_column("designations", "status")
    op.drop_column("departments", "status")
