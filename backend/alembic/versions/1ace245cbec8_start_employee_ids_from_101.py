"""start employee ids from 101

Revision ID: 1ace245cbec8
Revises: 2837089a9bf8
Create Date: 2026-09-30 11:58:06.251902

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1ace245cbec8"
down_revision: Union[str, Sequence[str], None] = "2837089a9bf8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER SEQUENCE employees_employee_id_seq RESTART WITH 101"
    )


def downgrade() -> None:
    op.execute(
        "ALTER SEQUENCE employees_employee_id_seq RESTART WITH 1"
    )