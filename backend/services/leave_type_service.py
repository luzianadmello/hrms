
from fastapi import HTTPException
from sqlalchemy import or_, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.leave_type import LeaveType


def list_leave_types(db: Session, q: str | None, page: int, page_size: int):
    query = db.query(LeaveType)

    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                LeaveType.leave_type_name.ilike(term),
                LeaveType.description.ilike(term),
            )
        )

    total = query.count()

    items = (
        query.order_by(LeaveType.leave_type_name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def get_leave_type(db: Session, leave_type_id: int):
    row = db.get(LeaveType, leave_type_id)

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Leave type not found."
        )

    return row


def create_leave_type(db: Session, data):
    name = data.leave_type_name.strip()

    if not name:
        raise HTTPException(
            status_code=422,
            detail="Leave type name cannot be blank."
        )

    row = LeaveType(
        leave_type_name=name,
        description=data.description.strip() if data.description else None,
        is_paid=data.is_paid,
    )

    db.add(row)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A leave type with this name already exists."
        ) from exc

    db.refresh(row)
    return row


def update_leave_type(db: Session, leave_type_id: int, data):
    row = get_leave_type(db, leave_type_id)

    changes = data.model_dump(exclude_unset=True)

    if "leave_type_name" in changes and changes["leave_type_name"] is not None:
        name = changes["leave_type_name"].strip()

        if not name:
            raise HTTPException(
                status_code=422,
                detail="Leave type name cannot be blank."
            )

        changes["leave_type_name"] = name

    if "description" in changes and changes["description"] is not None:
        changes["description"] = changes["description"].strip() or None

    for key, value in changes.items():
        setattr(row, key, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A leave type with this name already exists."
        ) from exc

    db.refresh(row)
    return row


def delete_leave_type(db: Session, leave_type_id: int):
    row = get_leave_type(db, leave_type_id)

    has_balance = db.execute(
        text("""
            SELECT 1
            FROM leaves
            WHERE leave_type_id = :leave_type_id
            LIMIT 1
        """),
        {"leave_type_id": leave_type_id},
    ).first()

    has_request = db.execute(
        text("""
            SELECT 1
            FROM leave_requests
            WHERE leave_type_id = :leave_type_id
            LIMIT 1
        """),
        {"leave_type_id": leave_type_id},
    ).first()

    if has_balance or has_request:
        raise HTTPException(
            status_code=409,
            detail=(
                "This leave type is linked to leave balances "
                "or requests and cannot be deleted."
            ),
        )

    db.delete(row)
    db.commit()

    return {"message": "Leave type deleted successfully."}
