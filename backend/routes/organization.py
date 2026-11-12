import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from config import settings
from database import get_db
from models.department import Department
from models.designation import Designation
from models.employee import Employee
from schemas.organization import (
    OrganizationRecordCreate, OrganizationRecordUpdate,
    OrganizationRecordResponse, OrganizationStatsResponse,
)
from utils.dependencies import require_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organization", tags=["Organization Management"])


def commit_or_http_error(db: Session, label: str) -> None:
    """Commit, turning any database failure into a readable JSON error.

    A raw exception becomes a bare 500 that skips the CORS headers, so the
    browser only shows "Network Error". HTTPException goes through the CORS
    middleware and the frontend can display the message.
    """
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.exception("Integrity error while saving %s", label)
        raise HTTPException(
            status_code=409,
            detail=f"This {label} could not be saved because it conflicts with an existing record.",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error while saving %s", label)
        detail = f"Database error while saving the {label}. Check the backend logs."
        if settings.environment == "development":
            detail += f" ({type(exc).__name__}: {getattr(exc, 'orig', exc)})"
        raise HTTPException(status_code=500, detail=detail) from exc


CONFIG = {
    "departments": {
        "model": Department, "id": "department_id", "name": "department_name",
        "view": "department.view", "create": "department.create",
        "update": "department.update", "deactivate": "department.deactivate",
        "employee_fk": "department_id",
    },
    "designations": {
        "model": Designation, "id": "designation_id", "name": "designation_name",
        "view": "designation.view", "create": "designation.create",
        "update": "designation.update", "deactivate": "designation.deactivate",
        "employee_fk": "designation_id",
    },
}

def get_config(kind: str):
    config = CONFIG.get(kind)
    if config is None:
        raise HTTPException(status_code=404, detail="Organization resource not found")
    return config

def serialize(db: Session, config: dict, row) -> dict:
    model = config["model"]
    id_attr = config["id"]
    name_attr = config["name"]
    fk = config["employee_fk"]
    count = db.query(func.count(Employee.employee_id)).filter(getattr(Employee, fk) == getattr(row, id_attr)).scalar() or 0
    return {"id": getattr(row, id_attr), "name": getattr(row, name_attr), "status": row.status, "employee_count": count}

def register_resource(kind: str):
    config = get_config(kind)
    model, id_attr, name_attr = config["model"], config["id"], config["name"]

    @router.get(f"/{kind}", response_model=list[OrganizationRecordResponse])
    def list_records(db: Session = Depends(get_db), _user=Depends(require_permission(config["view"]))):
        rows = db.query(model).order_by(getattr(model, name_attr).asc()).all()
        return [serialize(db, config, row) for row in rows]

    @router.get(f"/{kind}/stats", response_model=OrganizationStatsResponse)
    def record_stats(db: Session = Depends(get_db), _user=Depends(require_permission(config["view"]))):
        total = db.query(model).count()
        active = db.query(model).filter(model.status == "ACTIVE").count()
        return {"total": total, "active": active, "inactive": total - active}

    @router.post(f"/{kind}", response_model=OrganizationRecordResponse, status_code=status.HTTP_201_CREATED)
    def create_record(payload: OrganizationRecordCreate, db: Session = Depends(get_db), _user=Depends(require_permission(config["create"]))):
        name = payload.name.strip()
        duplicate = db.query(model).filter(func.lower(getattr(model, name_attr)) == name.lower()).first()
        if duplicate:
            raise HTTPException(status_code=409, detail=f"A {kind[:-1]} with this name already exists")
        row = model(**{name_attr: name}, status="ACTIVE")
        db.add(row)
        commit_or_http_error(db, kind[:-1])
        db.refresh(row)
        return serialize(db, config, row)

    @router.put(f"/{kind}/{{record_id}}", response_model=OrganizationRecordResponse)
    def update_record(record_id: int, payload: OrganizationRecordUpdate, db: Session = Depends(get_db), _user=Depends(require_permission(config["update"]))):
        row = db.get(model, record_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Record not found")
        name = payload.name.strip()
        duplicate = db.query(model).filter(func.lower(getattr(model, name_attr)) == name.lower(), getattr(model, id_attr) != record_id).first()
        if duplicate:
            raise HTTPException(status_code=409, detail=f"A {kind[:-1]} with this name already exists")
        setattr(row, name_attr, name)
        commit_or_http_error(db, kind[:-1])
        db.refresh(row)
        return serialize(db, config, row)


    return list_records, record_stats, create_record, update_record

# Keep endpoints explicitly permission-protected; no role-name checks.
for _kind in CONFIG:
    register_resource(_kind)

# Status changes are permission-checked according to the requested action.
def _set_status(db: Session, model, id_attr: str, name_attr: str, fk: str, record_id: int, payload: dict, user):
    from utils.dependencies import ensure_permission
    desired = str(payload.get("status", "")).upper().strip()
    if desired not in {"ACTIVE", "INACTIVE"}:
        raise HTTPException(status_code=422, detail="Status must be ACTIVE or INACTIVE")
    ensure_permission(db, user, "department.deactivate" if model is Department else "designation.deactivate")
    row = db.get(model, record_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Record not found")
    if desired == "INACTIVE":
        count = db.query(Employee).filter(getattr(Employee, fk) == record_id).count()
        if count:
            raise HTTPException(status_code=409, detail="This record is assigned to employees. Reassign them before deactivating it.")
    row.status = desired
    commit_or_http_error(db, "record")
    db.refresh(row)
    config = {"model": model, "id": id_attr, "name": name_attr, "employee_fk": fk}
    return serialize(db, config, row)

@router.patch("/departments/{record_id}/status", response_model=OrganizationRecordResponse)
def set_department_status(record_id: int, payload: dict, db: Session = Depends(get_db), user=Depends(require_permission("department.deactivate"))):
    return _set_status(db, Department, "department_id", "department_name", "department_id", record_id, payload, user)

@router.patch("/designations/{record_id}/status", response_model=OrganizationRecordResponse)
def set_designation_status(record_id: int, payload: dict, db: Session = Depends(get_db), user=Depends(require_permission("designation.deactivate"))):
    return _set_status(db, Designation, "designation_id", "designation_name", "designation_id", record_id, payload, user)