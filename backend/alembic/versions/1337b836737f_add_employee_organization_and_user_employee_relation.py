"""add employee organization and user employee relation

Revision ID: 1337b836737f
Revises: f9c96f5d15ea
"""

from typing import Sequence, Union

from alembic import op


revision: str = "1337b836737f"
down_revision: Union[str, Sequence[str], None] = "f9c96f5d15ea"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass