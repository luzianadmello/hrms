from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from database import get_db
from schemas.holiday import HolidayCreate, HolidayUpdate, HolidayResponse, HolidayListResponse
from services.holiday_service import list_holidays, create_holiday, update_holiday, delete_holiday, import_holidays_csv
from utils.dependencies import require_permission

router = APIRouter(prefix="/holidays", tags=["Holiday Management"])
VIEW = "holiday.view"
MANAGE = "holiday.manage"

@router.get("", response_model=HolidayListResponse)
def get_holidays(year: int | None = Query(None, ge=2000, le=9999), q: str | None = Query(None, max_length=100),
                 page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200),
                 db: Session = Depends(get_db), _user=Depends(require_permission(VIEW))):
    return list_holidays(db, year, q, page, page_size)

@router.post("", response_model=HolidayResponse, status_code=201)
def add_holiday(payload: HolidayCreate, db: Session = Depends(get_db), _user=Depends(require_permission(MANAGE))):
    return create_holiday(db, payload)

@router.patch("/{holiday_id}", response_model=HolidayResponse)
def edit_holiday(holiday_id: int, payload: HolidayUpdate, db: Session = Depends(get_db),
                 _user=Depends(require_permission(MANAGE))):
    return update_holiday(db, holiday_id, payload)

@router.delete("/{holiday_id}")
def remove_holiday(holiday_id: int, db: Session = Depends(get_db), _user=Depends(require_permission(MANAGE))):
    return delete_holiday(db, holiday_id)

@router.post("/import")
async def import_holiday_csv(request: Request, db: Session = Depends(get_db),
                             _user=Depends(require_permission(MANAGE))):
    csv_text = (await request.body()).decode("utf-8-sig")
    return import_holidays_csv(db, csv_text)
