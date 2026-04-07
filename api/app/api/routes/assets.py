from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.models.enums import AssetType
from app.schemas.common import MessageResponse
from app.schemas.portfolio import (
    AssetChartResponse,
    AssetCreate,
    AssetInstrumentOption,
    AssetPosition,
    AssetPriceUpdate,
    AssetUpdate,
)
from app.services.portfolio import (
    archive_asset,
    create_asset,
    get_asset_chart,
    list_positions,
    search_asset_instruments,
    sync_asset_market_price,
    update_asset,
    update_asset_price,
)

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=list[AssetPosition])
def get_positions(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[AssetPosition]:
    return list_positions(db, user.id)


@router.post("", response_model=AssetPosition)
def add_asset(
    payload: AssetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AssetPosition:
    asset = create_asset(db, user.id, payload, user.base_currency)
    return list_positions(db, user.id)[[position.id for position in list_positions(db, user.id)].index(asset.id)]


@router.patch("/{asset_id}", response_model=AssetPosition)
def patch_asset(
    asset_id: str,
    payload: AssetUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AssetPosition:
    try:
        asset = update_asset(db, user.id, asset_id, payload, user.base_currency)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    positions = list_positions(db, user.id)
    return next(position for position in positions if position.id == asset.id)


@router.delete("/{asset_id}", response_model=MessageResponse)
def delete_asset(
    asset_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageResponse:
    try:
        archive_asset(db, user.id, asset_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return MessageResponse(message="Asset archived")


@router.post("/{asset_id}/price", response_model=AssetPosition)
def patch_asset_price(
    asset_id: str,
    payload: AssetPriceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AssetPosition:
    try:
        asset = update_asset_price(db, user.id, asset_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    positions = list_positions(db, user.id)
    return next(position for position in positions if position.id == asset.id)


@router.post("/{asset_id}/price/sync", response_model=AssetPosition)
def sync_asset_price(
    asset_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AssetPosition:
    try:
        asset = sync_asset_market_price(db, user.id, asset_id, user.base_currency)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    positions = list_positions(db, user.id)
    return next(position for position in positions if position.id == asset.id)


@router.get("/{asset_id}/chart", response_model=AssetChartResponse)
def asset_chart(
    asset_id: str,
    range_days: int = Query(default=30, ge=7, le=365),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AssetChartResponse:
    try:
        return get_asset_chart(db, user.id, asset_id, user.base_currency, range_days)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/providers/search", response_model=list[AssetInstrumentOption])
def asset_provider_search(
    asset_type: AssetType,
    q: str = Query(min_length=2),
    _: User = Depends(get_current_user),
) -> list[AssetInstrumentOption]:
    try:
        return search_asset_instruments(asset_type, q)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
