"""add must change password

Revision ID: 28fac4ba7ea3
Revises: 2a42f000b4a5
Create Date: 2026-09-30 11:26:54.958542

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "28fac4ba7ea3"
down_revision: Union[str, Sequence[str], None] = "2a42f000b4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # Add must_change_password
    # Existing users will get False
    op.add_column(
        "users",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false")
        )
    )

    # Remove the database-level default after existing rows
    # have been populated
    op.alter_column(
        "users",
        "must_change_password",
        server_default=None
    )

    # Replace the old unique constraint on email
    # with the unique index expected by the model
    op.drop_constraint(
        "uq_users_new_email",
        "users",
        type_="unique"
    )

    op.create_index(
        op.f("ix_users_email"),
        "users",
        ["email"],
        unique=True
    )

    # Index user_id
    op.create_index(
        op.f("ix_users_user_id"),
        "users",
        ["user_id"],
        unique=False
    )


def downgrade() -> None:

    # Remove user_id index
    op.drop_index(
        op.f("ix_users_user_id"),
        table_name="users"
    )

    # Remove email index
    op.drop_index(
        op.f("ix_users_email"),
        table_name="users"
    )

    # Restore the original email unique constraint
    op.create_unique_constraint(
        "uq_users_new_email",
        "users",
        ["email"],
        postgresql_nulls_not_distinct=False
    )

    # Remove must_change_password
    op.drop_column(
        "users",
        "must_change_password"
    )