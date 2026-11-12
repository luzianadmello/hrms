from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.employee import Employee
from models.holiday import Holiday
from models.leave_balance import LeaveBalance
from models.leave_request import LeaveRequest
from models.leave_type import LeaveType
from models.role import Role
from models.user import User
from services import attendance_rules as attendance_rules
from services.attendance_policy_service import load_policies


ZERO = Decimal("0.00")
HALF = Decimal("0.50")
ONE = Decimal("1.00")
ACTIVE_REQUEST_STATUSES = ("PENDING", "APPROVED")


def _calculate_leave_days(
    db: Session,
    start_date: date,
    end_date: date,
    is_half_day: bool = False,
) -> Decimal:
    """Count policy working days, excluding company holidays."""
    if end_date < start_date:
        raise HTTPException(
            status_code=422,
            detail="End date cannot be before start date.",
        )

    if start_date.year != end_date.year:
        raise HTTPException(
            status_code=422,
            detail="Leave requests cannot cross calendar years. Submit separate requests for each year.",
        )

    holiday_dates = {
        row[0]
        for row in db.query(Holiday.holiday_date)
        .filter(
            Holiday.holiday_date >= start_date,
            Holiday.holiday_date <= end_date,
        )
        .all()
    }

    # Leave days follow the same effective-dated weekly-off policy as attendance.
    # This prevents leave balances from counting a configured weekly off as leave.
    policies = load_policies(db)
    working_dates = []
    current_date = start_date
    while current_date <= end_date:
        policy = attendance_rules.policy_for(current_date, policies)
        if current_date.weekday() not in policy.weekly_offs and current_date not in holiday_dates:
            working_dates.append(current_date)
        current_date = date.fromordinal(current_date.toordinal() + 1)

    if is_half_day:
        if start_date != end_date:
            raise HTTPException(
                status_code=422,
                detail="Half-day leave must be for a single date.",
            )
        if not working_dates:
            raise HTTPException(
                status_code=422,
                detail="Half-day leave cannot be requested on a weekend or company holiday.",
            )
        return HALF

    days = Decimal(len(working_dates)).quantize(Decimal("0.00"))
    if days <= ZERO:
        raise HTTPException(
            status_code=422,
            detail="The selected date range contains no working days.",
        )
    return days


def _get_leave_type(db: Session, leave_type_id: int) -> LeaveType:
    leave_type = db.get(LeaveType, leave_type_id)
    if leave_type is None:
        raise HTTPException(status_code=404, detail="Leave type not found.")
    return leave_type


def _get_employee(db: Session, employee_id: int) -> Employee:
    employee = db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee profile not found.")
    return employee


def _check_overlapping_request(
    db: Session,
    employee_id: int,
    start_date: date,
    end_date: date,
    exclude_leave_id: int | None = None,
) -> None:
    query = db.query(LeaveRequest).filter(
        LeaveRequest.employee_id == employee_id,
        LeaveRequest.status.in_(ACTIVE_REQUEST_STATUSES),
        LeaveRequest.start_date <= end_date,
        LeaveRequest.end_date >= start_date,
    )

    if exclude_leave_id is not None:
        query = query.filter(LeaveRequest.leave_id != exclude_leave_id)

    if query.first():
        raise HTTPException(
            status_code=409,
            detail="You already have a pending or approved leave request overlapping these dates.",
        )


def _get_pending_reserved_days(
    db: Session,
    employee_id: int,
    leave_type_id: int,
    year: int,
    exclude_leave_id: int | None = None,
) -> Decimal:
    query = db.query(func.coalesce(func.sum(LeaveRequest.days), 0)).filter(
        LeaveRequest.employee_id == employee_id,
        LeaveRequest.leave_type_id == leave_type_id,
        LeaveRequest.status == "PENDING",
        LeaveRequest.start_date >= date(year, 1, 1),
        LeaveRequest.start_date <= date(year, 12, 31),
    )

    if exclude_leave_id is not None:
        query = query.filter(LeaveRequest.leave_id != exclude_leave_id)

    return Decimal(query.scalar() or ZERO)


def _validate_paid_leave_availability(
    db: Session,
    employee_id: int,
    leave_type_id: int,
    year: int,
    requested_days: Decimal,
    exclude_leave_id: int | None = None,
) -> LeaveBalance:
    balance = (
        db.query(LeaveBalance)
        .filter(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_type_id == leave_type_id,
            LeaveBalance.year == year,
        )
        .with_for_update()
        .first()
    )

    if balance is None:
        raise HTTPException(
            status_code=422,
            detail="No leave balance has been allocated for this leave type and year. Contact HR.",
        )

    remaining = Decimal(balance.remaining_days)
    pending_reserved = _get_pending_reserved_days(
        db,
        employee_id,
        leave_type_id,
        year,
        exclude_leave_id=exclude_leave_id,
    )

    available = remaining - pending_reserved
    if requested_days > available:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Insufficient {leave_type_id} leave balance. "
                f"Available after pending requests: {max(available, ZERO)} days; "
                f"requested: {requested_days} days."
            ),
        )

    return balance


def create_leave_request(db: Session, employee_id: int, data):
    """Create a pending request for the authenticated employee."""
    _get_employee(db, employee_id)
    leave_type = _get_leave_type(db, data.leave_type_id)

    days = _calculate_leave_days(
        db,
        data.start_date,
        data.end_date,
        data.is_half_day,
    )

    _check_overlapping_request(
        db,
        employee_id,
        data.start_date,
        data.end_date,
    )

    if leave_type.is_paid:
        _validate_paid_leave_availability(
            db,
            employee_id,
            leave_type.leave_type_id,
            data.start_date.year,
            days,
        )

    row = LeaveRequest(
        employee_id=employee_id,
        leave_type_id=leave_type.leave_type_id,
        start_date=data.start_date,
        end_date=data.end_date,
        days=days,
        reason=data.reason.strip(),
        status="PENDING",
    )

    try:
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Unable to create the leave request because it conflicts with existing data.",
        ) from exc
    except Exception:
        db.rollback()
        raise


def list_my_leave_requests(
    db: Session,
    employee_id: int,
    *,
    status: str | None,
    page: int,
    page_size: int,
):
    query = db.query(LeaveRequest).filter(
        LeaveRequest.employee_id == employee_id
    )

    if status:
        query = query.filter(LeaveRequest.status == status.upper())

    total = query.count()
    rows = (
        query.order_by(
            LeaveRequest.start_date.desc(),
            LeaveRequest.leave_id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def list_team_leave_requests(
    db: Session,
    manager_employee_id: int,
    *,
    status: str | None,
    page: int,
    page_size: int,
):
    team_employee_ids = (
        db.query(Employee.employee_id)
        .filter(Employee.manager_id == manager_employee_id)
        .subquery()
    )

    query = db.query(LeaveRequest).filter(
        LeaveRequest.employee_id.in_(team_employee_ids)
    )

    if status:
        query = query.filter(LeaveRequest.status == status.upper())

    total = query.count()
    rows = (
        query.order_by(
            LeaveRequest.start_date.desc(),
            LeaveRequest.leave_id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def list_all_leave_requests(
    db: Session,
    *,
    employee_id: int | None,
    status: str | None,
    page: int,
    page_size: int,
):
    query = db.query(LeaveRequest)

    if employee_id is not None:
        query = query.filter(LeaveRequest.employee_id == employee_id)

    if status:
        query = query.filter(LeaveRequest.status == status.upper())

    total = query.count()
    rows = (
        query.order_by(
            LeaveRequest.start_date.desc(),
            LeaveRequest.leave_id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def _get_role_name_for_employee(db: Session, employee_id: int) -> str | None:
    return (
        db.query(Role.name)
        .join(User, User.role_id == Role.id)
        .filter(User.employee_id == employee_id)
        .scalar()
    )


def _get_role_name_for_user(db: Session, user_id: int) -> str | None:
    return (
        db.query(Role.name)
        .join(User, User.role_id == Role.id)
        .filter(User.user_id == user_id)
        .scalar()
    )


def review_leave_request(
    db: Session,
    leave_id: int,
    reviewer_user_id: int,
    reviewer_employee_id: int | None,
    decision: str,
):
    """
    Employee requests: only the assigned MANAGER can review.
    Manager requests: only an HR user can review.
    HR/Admin requests are not reviewable in this workflow.
    """
    decision = decision.upper()
    if decision not in ("APPROVED", "REJECTED"):
        raise HTTPException(
            status_code=422,
            detail="Review decision must be APPROVED or REJECTED.",
        )

    try:
        request = (
            db.query(LeaveRequest)
            .filter(LeaveRequest.leave_id == leave_id)
            .with_for_update()
            .first()
        )
        if request is None:
            raise HTTPException(status_code=404, detail="Leave request not found.")
        if request.status != "PENDING":
            raise HTTPException(
                status_code=409,
                detail="Only pending leave requests can be reviewed.",
            )

        applicant = _get_employee(db, request.employee_id)
        applicant_role = _get_role_name_for_employee(db, request.employee_id)
        reviewer_role = _get_role_name_for_user(db, reviewer_user_id)

        if applicant_role is None or reviewer_role is None:
            raise HTTPException(
                status_code=403,
                detail="Unable to verify applicant or reviewer role.",
            )

        if applicant_role == "EMPLOYEE":
            if reviewer_employee_id is not None and applicant.employee_id == reviewer_employee_id:
                raise HTTPException(
                    status_code=403,
                    detail="You cannot approve or reject your own leave request.",
                )
            if reviewer_role != "MANAGER":
                raise HTTPException(
                    status_code=403,
                    detail="Only the assigned reporting manager can review an employee's leave request.",
                )
            if reviewer_employee_id is None or applicant.manager_id != reviewer_employee_id:
                raise HTTPException(
                    status_code=403,
                    detail="Only the employee's assigned reporting manager can review this request.",
                )
        elif applicant_role == "MANAGER":
            if reviewer_role != "HR":
                raise HTTPException(
                    status_code=403,
                    detail="Only HR can review a manager's leave request.",
                )
            if applicant.employee_id == reviewer_employee_id:
                raise HTTPException(
                    status_code=403,
                    detail="You cannot approve or reject your own leave request.",
                )
        else:
            raise HTTPException(
                status_code=403,
                detail="Leave requests submitted by this role cannot be reviewed in the current workflow.",
            )

        if decision == "APPROVED":
            leave_type = _get_leave_type(db, request.leave_type_id)
            if leave_type.is_paid:
                balance = (
                    db.query(LeaveBalance)
                    .filter(
                        LeaveBalance.employee_id == request.employee_id,
                        LeaveBalance.leave_type_id == request.leave_type_id,
                        LeaveBalance.year == request.start_date.year,
                    )
                    .with_for_update()
                    .first()
                )
                if balance is None:
                    raise HTTPException(
                        status_code=409,
                        detail="Leave balance no longer exists. Contact HR.",
                    )

                remaining = Decimal(balance.remaining_days)
                other_pending = _get_pending_reserved_days(
                    db,
                    request.employee_id,
                    request.leave_type_id,
                    request.start_date.year,
                    exclude_leave_id=request.leave_id,
                )
                if Decimal(request.days) > remaining - other_pending:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "Insufficient available balance to approve this request. "
                            "Review other pending requests or contact HR."
                        ),
                    )
                balance.used_days = Decimal(balance.used_days) + Decimal(request.days)
                balance.remaining_days = remaining - Decimal(request.days)

        request.status = decision
        request.approved_by = reviewer_user_id
        request.approved_on = func.now()
        db.commit()
        db.refresh(request)
        return request

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


def delete_own_pending_leave_request(
    db: Session,
    leave_id: int,
    employee_id: int,
) -> None:
    """Permanently delete an employee's own pending leave request."""
    try:
        request = (
            db.query(LeaveRequest)
            .filter(
                LeaveRequest.leave_id == leave_id,
                LeaveRequest.employee_id == employee_id,
            )
            .with_for_update()
            .first()
        )

        if request is None:
            raise HTTPException(status_code=404, detail="Leave request not found.")

        if request.status != "PENDING":
            raise HTTPException(
                status_code=409,
                detail="Only pending leave requests can be deleted.",
            )

        db.delete(request)
        db.commit()

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
