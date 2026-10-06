"""make timestamps timezone aware

Revision ID: 48802c901590
Revises: 84fe6650307b
Create Date: 2026-10-05 15:12:40.491911

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '48802c901590'
down_revision: Union[str, Sequence[str], None] = '84fe6650307b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        'employees',
        'profile_completed_at',
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
        postgresql_using="profile_completed_at AT TIME ZONE 'UTC'",
    )

    op.alter_column(
        'users',
        'last_login',
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
        postgresql_using="last_login AT TIME ZONE 'UTC'",
    )

    op.alter_column(
        'users',
        'created_at',
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
        existing_server_default=sa.text('now()'),
        postgresql_using="created_at AT TIME ZONE 'UTC'",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        'users',
        'created_at',
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
        existing_server_default=sa.text('now()')
    )

    op.alter_column(
        'users',
        'last_login',
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True
    )

    op.alter_column(
        'employees',
        'profile_completed_at',
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True
    )