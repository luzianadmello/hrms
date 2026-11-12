import csv
import io
from datetime import date
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from fastapi import HTTPException
from models.holiday import Holiday

def list_holidays(db: Session, year: int | None, q: str | None, page: int, page_size: int):
    query = db.query(Holiday)
    if year is not None:
        query = query.filter(func.extract("year", Holiday.holiday_date) == year)
    if q:
        query = query.filter(Holiday.holiday_name.ilike(f"%{q.strip()}%"))
    total = query.count()
    rows = query.order_by(Holiday.holiday_date.asc(), Holiday.holiday_name.asc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": rows, "total": total, "page": page, "page_size": page_size}

def create_holiday(db: Session, data):
    holiday_name = data.holiday_name.strip()
    if not holiday_name:
        raise HTTPException(status_code=422, detail="Holiday name cannot be blank.")
    row = Holiday(holiday_name=holiday_name, holiday_date=data.holiday_date, description=data.description.strip() if data.description else None)
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A holiday already exists on this date.") from exc
    db.refresh(row)
    return row

def update_holiday(db: Session, holiday_id: int, data):
    row = db.get(Holiday, holiday_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Holiday not found.")
    changes = data.model_dump(exclude_unset=True)
    if "holiday_name" in changes and changes["holiday_name"] is not None:
        changes["holiday_name"] = changes["holiday_name"].strip()
        if not changes["holiday_name"]:
            raise HTTPException(status_code=422, detail="Holiday name cannot be blank.")
    if "description" in changes and changes["description"] is not None:
        changes["description"] = changes["description"].strip() or None
    for key, value in changes.items():
        setattr(row, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A holiday already exists on this date.") from exc
    db.refresh(row)
    return row

def delete_holiday(db: Session, holiday_id: int):
    row = db.get(Holiday, holiday_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Holiday not found.")
    db.delete(row)
    db.commit()
    return {"message": "Holiday deleted successfully."}

def import_holidays_csv(db: Session, csv_text: str):
    try:
        reader = csv.DictReader(io.StringIO(csv_text.lstrip("\ufeff")))
        required = {"holiday_name", "holiday_date"}
        if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
            raise HTTPException(status_code=422, detail="CSV must contain holiday_name and holiday_date columns.")
        parsed, seen_dates = [], set()
        for line_no, item in enumerate(reader, start=2):
            name = (item.get("holiday_name") or "").strip()
            raw_date = (item.get("holiday_date") or "").strip()
            if not name or not raw_date:
                raise HTTPException(status_code=422, detail=f"Missing holiday name/date on CSV row {line_no}.")
            try:
                holiday_date = date.fromisoformat(raw_date)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=f"Invalid date on CSV row {line_no}; use YYYY-MM-DD.") from exc
            if holiday_date in seen_dates:
                raise HTTPException(status_code=409, detail=f"Duplicate date in CSV: {raw_date}.")
            seen_dates.add(holiday_date)
            parsed.append(Holiday(holiday_name=name, holiday_date=holiday_date, description=(item.get("description") or "").strip() or None))
        if not parsed:
            raise HTTPException(status_code=422, detail="CSV contains no holiday records.")
        existing = {row[0] for row in db.query(Holiday.holiday_date).filter(Holiday.holiday_date.in_(seen_dates)).all()}
        if existing:
            conflicts = sorted(d.isoformat() for d in existing)
            raise HTTPException(status_code=409, detail=f"Holidays already exist for: {', '.join(conflicts)}.")
        db.add_all(parsed)
        db.commit()
        return {"imported": len(parsed), "message": f"Imported {len(parsed)} holidays successfully."}
    except Exception:
        db.rollback()
        raise
