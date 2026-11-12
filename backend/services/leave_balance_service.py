from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.employee import Employee
from models.leave_type import LeaveType
from models.leave_balance import LeaveBalance


ZERO = Decimal("0.00")


def _employee_name(employee: Employee) -> str:
    return " ".join(
        part
        for part in [
            employee.first_name,
            employee.last_name,
        ]
        if part and part.strip()
    ) or employee.employee_code


def _build_employee_leave_balances(
    employee: Employee,
    leave_types: list[LeaveType],
    balances: list[LeaveBalance],
    year: int,
):
    balance_by_type = {
        balance.leave_type_id: balance
        for balance in balances
    }

    leave_balance_items = []

    for leave_type in leave_types:
        balance = balance_by_type.get(
            leave_type.leave_type_id
        )

        leave_balance_items.append({
            "leave_type_id": leave_type.leave_type_id,
            "leave_type_name": leave_type.leave_type_name,
            "is_paid": leave_type.is_paid,
            "allocated_days": (
                Decimal(balance.allocated_days)
                if balance else ZERO
            ),
            "used_days": (
                Decimal(balance.used_days)
                if balance else ZERO
            ),
            "remaining_days": (
                Decimal(balance.remaining_days)
                if balance else ZERO
            ),
        })

    return {
        "employee_id": employee.employee_id,
        "employee_code": employee.employee_code,
        "employee_name": _employee_name(employee),
        "year": year,
        "leave_balances": leave_balance_items,
    }


def list_leave_balances(
    db: Session,
    *,
    employee_id: int | None,
    year: int,
    page: int,
    page_size: int,
):
    """
    HR/Admin view.

    Returns employees grouped with all configured leave types
    for the requested year.
    """

    employee_query = db.query(Employee)
    if employee_id is not None:
        employee_query = employee_query.filter(Employee.employee_id == employee_id)

    total_query = db.query(func.count(Employee.employee_id))
    if employee_id is not None:
        total_query = total_query.filter(Employee.employee_id == employee_id)
    total_count = total_query.scalar() or 0

    employees = (
        employee_query
        .order_by(Employee.employee_id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    if not employees:
        return {
            "items": [],
            "total": total_count,
            "page": page,
            "page_size": page_size,
        }

    employee_ids = [employee.employee_id for employee in employees]
    leave_types = (
        db.query(LeaveType)
        .order_by(LeaveType.leave_type_id.asc())
        .all()
    )
    balances = (
        db.query(LeaveBalance)
        .filter(
            LeaveBalance.employee_id.in_(employee_ids),
            LeaveBalance.year == year,
        )
        .all()
    )
    balances_by_employee = {}
    for balance in balances:
        balances_by_employee.setdefault(balance.employee_id, []).append(balance)

    items = [
        _build_employee_leave_balances(
            employee,
            leave_types,
            balances_by_employee.get(employee.employee_id, []),
            year,
        )
        for employee in employees
    ]

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
    }

def get_my_leave_balances(
    db: Session,
    employee_id: int,
    year: int,
):
    """
    Employee view.

    Returns all configured leave types for the logged-in employee.
    """

    employee = db.get(Employee, employee_id)

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Employee not found.",
        )

    leave_types = (
        db.query(LeaveType)
        .order_by(LeaveType.leave_type_id.asc())
        .all()
    )

    balances = (
        db.query(LeaveBalance)
        .filter(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.year == year,
        )
        .all()
    )

    return _build_employee_leave_balances(
        employee,
        leave_types,
        balances,
        year,
    )


def get_leave_balance(
    db: Session,
    balance_id: int,
):
    row = db.get(LeaveBalance, balance_id)

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Leave balance not found.",
        )

    return row


def create_or_update_leave_balances(
    db: Session,
    data,
):
    """
    Create or update all leave balances for one employee and year.

    Existing used_days are preserved.
    Missing balances are created with used_days = 0.
    Every configured leave type must be included.
    """

    employee = db.get(Employee, data.employee_id)

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Employee not found.",
        )

    submitted_ids = [
        item.leave_type_id
        for item in data.allocations
    ]

    if len(submitted_ids) != len(set(submitted_ids)):
        raise HTTPException(
            status_code=409,
            detail="Each leave type can only be allocated once.",
        )

    leave_types = (
        db.query(LeaveType)
        .order_by(LeaveType.leave_type_id.asc())
        .all()
    )

    if not leave_types:
        raise HTTPException(
            status_code=422,
            detail="No leave types have been configured.",
        )

    configured_ids = {
        leave_type.leave_type_id
        for leave_type in leave_types
    }

    submitted_id_set = set(submitted_ids)

    invalid_ids = submitted_id_set - configured_ids
    missing_ids = configured_ids - submitted_id_set

    if invalid_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Invalid leave type IDs: {sorted(invalid_ids)}",
        )

    if missing_ids:
        raise HTTPException(
            status_code=422,
            detail=(
                "Allocations must include every configured leave type. "
                f"Missing leave type IDs: {sorted(missing_ids)}"
            ),
        )

    allocations_by_type = {
        item.leave_type_id: Decimal(item.allocated_days)
        for item in data.allocations
    }

    try:
        existing_rows = (
            db.query(LeaveBalance)
            .filter(
                LeaveBalance.employee_id == data.employee_id,
                LeaveBalance.year == data.year,
            )
            .with_for_update()
            .all()
        )

        existing_by_type = {
            row.leave_type_id: row
            for row in existing_rows
        }

        for leave_type_id in sorted(configured_ids):
            allocated = allocations_by_type[leave_type_id]

            existing = existing_by_type.get(leave_type_id)

            if existing:
                used = Decimal(existing.used_days)

                if allocated < used:
                    raise HTTPException(
                        status_code=422,
                        detail=(
                            f"Allocation for leave type {leave_type_id} "
                            f"cannot be lower than its used days ({used})."
                        ),
                    )

                existing.allocated_days = allocated
                existing.remaining_days = allocated - used

            else:
                db.add(
                    LeaveBalance(
                        employee_id=data.employee_id,
                        leave_type_id=leave_type_id,
                        year=data.year,
                        allocated_days=allocated,
                        used_days=ZERO,
                        remaining_days=allocated,
                    )
                )

        db.flush()
        db.commit()

    except HTTPException:
        db.rollback()
        raise

    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "Unable to save leave allocations because "
                "a conflicting balance already exists."
            ),
        ) from exc

    saved_rows = (
        db.query(LeaveBalance)
        .filter(
            LeaveBalance.employee_id == data.employee_id,
            LeaveBalance.year == data.year,
        )
        .order_by(LeaveBalance.leave_type_id.asc())
        .all()
    )

    return {
        "items": saved_rows,
        "total": len(saved_rows),
        "message": "Leave allocations saved successfully.",
    }


def update_leave_balance(
    db: Session,
    balance_id: int,
    data,
):
    row = (
        db.query(LeaveBalance)
        .filter(LeaveBalance.balance_id == balance_id)
        .with_for_update()
        .first()
    )

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Leave balance not found.",
        )

    allocated = Decimal(data.allocated_days)
    used = Decimal(row.used_days)

    if allocated < used:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Allocated days cannot be lower than "
                f"used days ({used})."
            ),
        )

    row.allocated_days = allocated
    row.remaining_days = allocated - used

    db.commit()
    db.refresh(row)

    return row