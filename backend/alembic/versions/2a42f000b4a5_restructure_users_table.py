"""restructure users table

Revision ID: 2a42f000b4a5
Revises: 1337b836737f
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2a42f000b4a5"
down_revision: Union[str, Sequence[str], None] = "1337b836737f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # Create the new users table in the required column order
    op.create_table(
        "users_new",

        sa.Column(
            "user_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True
        ),

        sa.Column(
            "role_id",
            sa.Integer(),
            sa.ForeignKey("roles.id"),
            nullable=False
        ),

        sa.Column(
            "employee_id",
            sa.Integer(),
            sa.ForeignKey("employees.employee_id"),
            nullable=True
        ),

        sa.Column(
            "email",
            sa.String(),
            nullable=False
        ),

        sa.Column(
            "password_hash",
            sa.String(),
            nullable=False
        ),

        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False
        ),

        sa.Column(
            "last_login",
            sa.DateTime(timezone=False),
            nullable=True
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=False),
            server_default=sa.func.now()
        ),

        sa.UniqueConstraint(
            "email",
            name="uq_users_new_email"
        ),

        sa.UniqueConstraint(
            "employee_id",
            name="uq_users_new_employee_id"
        )
    )

    # Copy existing users into the new table
    op.execute("""
        INSERT INTO users_new
        (
            user_id,
            role_id,
            employee_id,
            email,
            password_hash,
            is_active,
            last_login,
            created_at
        )
        SELECT
            id,
            role_id,
            employee_id,
            email,
            password_hash,
            is_active,
            last_login,
            created_at
        FROM users
    """)

    # Remove old users table
    op.drop_table("users")

    # Rename new table
    op.rename_table("users_new", "users")


def downgrade() -> None:

    # Recreate the old users structure
    op.create_table(
        "users_old",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True
        ),

        sa.Column(
            "email",
            sa.String(),
            nullable=False
        ),

        sa.Column(
            "password_hash",
            sa.String(),
            nullable=False
        ),

        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False
        ),

        sa.Column(
            "last_login",
            sa.DateTime(timezone=False),
            nullable=True
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=False),
            server_default=sa.func.now()
        ),

        sa.Column(
            "role_id",
            sa.Integer(),
            sa.ForeignKey("roles.id"),
            nullable=False
        ),

        sa.Column(
            "employee_id",
            sa.Integer(),
            sa.ForeignKey("employees.employee_id"),
            nullable=True
        ),

        sa.UniqueConstraint(
            "email",
            name="uq_users_old_email"
        ),

        sa.UniqueConstraint(
            "employee_id",
            name="uq_users_old_employee_id"
        )
    )

    op.execute("""
        INSERT INTO users_old
        (
            id,
            email,
            password_hash,
            is_active,
            last_login,
            created_at,
            role_id,
            employee_id
        )
        SELECT
            user_id,
            email,
            password_hash,
            is_active,
            last_login,
            created_at,
            role_id,
            employee_id
        FROM users
    """)

    op.drop_table("users")

    op.rename_table("users_old", "users")