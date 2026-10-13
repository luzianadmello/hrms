"""add profile_completed to users

Revision ID: c3d41e7a9b52
Revises: a1b2c3d4e5f6
Create Date: 2026-10-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c3d41e7a9b52"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "profile_completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # Existing accounts: do not force them back through Complete Profile if
    # they obviously do not need it.
    #   - accounts with no employee record (e.g. the Admin)
    #   - accounts whose employee already has a saved address
    op.execute(
        """
        UPDATE users
        SET profile_completed = true
        WHERE employee_id IS NULL
           OR employee_id IN (
                SELECT employee_id
                FROM employees
                WHERE residential_address_id IS NOT NULL
           )
        """
    )


def downgrade() -> None:
    op.drop_column("users", "profile_completed")