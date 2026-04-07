from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

from app.core.config import get_settings
from app.models import Asset
from app.models.enums import AssetType
from app.schemas.portfolio import AssetInstrumentOption

settings = get_settings()


@dataclass
class PriceSnapshot:
    price: float
    price_in_base: float
    source: str
    priced_at: date


@dataclass
class ChartPoint:
    date: date
    price: float
    price_in_base: float


def provider_for_asset_type(asset_type: AssetType) -> str | None:
    if asset_type == AssetType.CRYPTO:
        return "coingecko"
    if asset_type in {AssetType.STOCK, AssetType.ETF, AssetType.CASH, AssetType.METAL}:
        return "twelvedata"
    return None


def search_instruments(asset_type: AssetType, query: str) -> list[AssetInstrumentOption]:
    provider = provider_for_asset_type(asset_type)
    if not provider:
        return []
    if provider == "coingecko":
        return _search_coingecko(asset_type, query)
    return _search_twelvedata(asset_type, query)


def fetch_latest_price(asset: Asset, base_currency: str) -> PriceSnapshot:
    if not asset.tracking_enabled:
        raise ValueError("Для этого актива не включено отслеживание цены")
    provider = (asset.tracking_provider or provider_for_asset_type(asset.type) or "").lower()
    if provider == "coingecko":
        return _fetch_coingecko_latest(asset, base_currency)
    if provider == "twelvedata":
        return _fetch_twelvedata_latest(asset, base_currency)
    raise ValueError("Для актива не настроен поддерживаемый провайдер цены")


def fetch_chart(asset: Asset, base_currency: str, range_days: int) -> list[ChartPoint]:
    if not asset.tracking_enabled:
        raise ValueError("Для этого актива не включено отслеживание графика")
    provider = (asset.tracking_provider or provider_for_asset_type(asset.type) or "").lower()
    if provider == "coingecko":
        return _fetch_coingecko_chart(asset, base_currency, range_days)
    if provider == "twelvedata":
        return _fetch_twelvedata_chart(asset, base_currency, range_days)
    raise ValueError("Для актива не настроен поддерживаемый график цены")


def _search_coingecko(asset_type: AssetType, query: str) -> list[AssetInstrumentOption]:
    payload = _http_get_json(
        settings.coingecko_base_url.rstrip("/") + "/search",
        params={"query": query},
        headers=_coingecko_headers(),
    )
    results = []
    for item in payload.get("coins", [])[:12]:
        results.append(
            AssetInstrumentOption(
                provider="coingecko",
                asset_type=asset_type,
                external_id=str(item.get("id") or ""),
                symbol=str(item.get("symbol") or "").upper(),
                name=str(item.get("name") or ""),
                currency="USD",
                market=str(item.get("market_cap_rank") or ""),
            )
        )
    return results


def _search_twelvedata(asset_type: AssetType, query: str) -> list[AssetInstrumentOption]:
    api_key = settings.twelvedata_api_key
    if not api_key:
        raise ValueError("Для поиска через Twelve Data нужен TWELVEDATA_API_KEY")

    if asset_type in {AssetType.STOCK, AssetType.ETF}:
        payload = _http_get_json(
            settings.twelvedata_base_url.rstrip("/") + "/symbol_search",
            params={"symbol": query, "apikey": api_key, "outputsize": 15},
        )
        data = payload.get("data", [])
        results = []
        for item in data:
            instrument_type = str(item.get("instrument_type") or item.get("type") or "")
            if asset_type == AssetType.STOCK and "ETF" in instrument_type.upper():
                continue
            if asset_type == AssetType.ETF and "ETF" not in instrument_type.upper():
                continue
            results.append(
                AssetInstrumentOption(
                    provider="twelvedata",
                    asset_type=asset_type,
                    external_id=str(item.get("symbol") or ""),
                    symbol=str(item.get("symbol") or ""),
                    name=str(item.get("instrument_name") or item.get("name") or item.get("symbol") or ""),
                    currency=str(item.get("currency") or "USD"),
                    market=str(item.get("exchange") or ""),
                )
            )
        return results[:12]

    if asset_type == AssetType.CASH:
        payload = _http_get_json(
            settings.twelvedata_base_url.rstrip("/") + "/forex_pairs",
            params={"symbol": query.upper(), "apikey": api_key},
        )
        return [
            AssetInstrumentOption(
                provider="twelvedata",
                asset_type=asset_type,
                external_id=str(item.get("symbol") or ""),
                symbol=str(item.get("symbol") or ""),
                name=str(item.get("currency_base") or item.get("symbol") or ""),
                currency=str(item.get("currency_quote") or ""),
                market="Forex",
            )
            for item in payload.get("data", [])[:12]
        ]

    if asset_type == AssetType.METAL:
        payload = _http_get_json(
            settings.twelvedata_base_url.rstrip("/") + "/commodities",
            params={"symbol": query.upper(), "apikey": api_key},
        )
        results = []
        for item in payload.get("data", [])[:12]:
            symbol = str(item.get("symbol") or "")
            if not symbol.startswith(("XAU", "XAG", "XPT", "XPD")):
                continue
            results.append(
                AssetInstrumentOption(
                    provider="twelvedata",
                    asset_type=asset_type,
                    external_id=symbol,
                    symbol=symbol,
                    name=str(item.get("name") or symbol),
                    currency=str(item.get("currency") or "USD"),
                    market="Precious Metal",
                )
            )
        return results

    return []


def _fetch_coingecko_latest(asset: Asset, base_currency: str) -> PriceSnapshot:
    coin_id = asset.tracking_external_id or asset.symbol
    if not coin_id:
        raise ValueError("Для криптоактива нужен CoinGecko ID")
    quote = (asset.currency or "USD").lower()
    vs = {quote, base_currency.lower()}
    payload = _http_get_json(
        settings.coingecko_base_url.rstrip("/") + "/simple/price",
        params={
            "ids": coin_id.lower(),
            "vs_currencies": ",".join(sorted(vs)),
            "include_last_updated_at": "true",
        },
        headers=_coingecko_headers(),
    )
    item = payload.get(coin_id.lower())
    if not item:
        raise ValueError("CoinGecko не вернул цену по активу")
    priced_at = date.today()
    if item.get("last_updated_at"):
        priced_at = datetime.fromtimestamp(item["last_updated_at"], tz=timezone.utc).date()
    return PriceSnapshot(
        price=float(item.get(quote) or 0),
        price_in_base=float(item.get(base_currency.lower()) or 0),
        source="coingecko",
        priced_at=priced_at,
    )


def _fetch_coingecko_chart(asset: Asset, base_currency: str, range_days: int) -> list[ChartPoint]:
    coin_id = asset.tracking_external_id or asset.symbol
    if not coin_id:
        raise ValueError("Для криптоактива нужен CoinGecko ID")
    now = datetime.now(tz=timezone.utc)
    start = now - timedelta(days=range_days)
    payload = _http_get_json(
        settings.coingecko_base_url.rstrip("/") + f"/coins/{coin_id.lower()}/market_chart/range",
        params={
            "vs_currency": base_currency.lower(),
            "from": int(start.timestamp()),
            "to": int(now.timestamp()),
        },
        headers=_coingecko_headers(),
    )
    points: list[ChartPoint] = []
    for timestamp_ms, price_in_base in payload.get("prices", []):
        point_date = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).date()
        if points and points[-1].date == point_date:
            points[-1] = ChartPoint(date=point_date, price=float(price_in_base), price_in_base=float(price_in_base))
            continue
        points.append(ChartPoint(date=point_date, price=float(price_in_base), price_in_base=float(price_in_base)))
    return points


def _fetch_twelvedata_latest(asset: Asset, base_currency: str) -> PriceSnapshot:
    api_key = settings.twelvedata_api_key
    if not api_key:
        raise ValueError("Для рыночных активов нужен TWELVEDATA_API_KEY")
    symbol = (asset.tracking_symbol or asset.tracking_external_id or asset.symbol or "").upper()
    if not symbol:
        raise ValueError("Для актива нужен символ провайдера")

    if asset.type == AssetType.CASH:
        rate = _fetch_twelvedata_price(symbol)
        return PriceSnapshot(
            price=1.0,
            price_in_base=rate,
            source="twelvedata",
            priced_at=date.today(),
        )

    local_price = _fetch_twelvedata_price(symbol)
    quote_currency = _infer_quote_currency(asset, symbol)
    price_in_base = local_price if quote_currency == base_currency.upper() else _convert_with_twelvedata(local_price, quote_currency, base_currency)
    return PriceSnapshot(
        price=local_price,
        price_in_base=price_in_base,
        source="twelvedata",
        priced_at=date.today(),
    )


def _fetch_twelvedata_chart(asset: Asset, base_currency: str, range_days: int) -> list[ChartPoint]:
    api_key = settings.twelvedata_api_key
    if not api_key:
        raise ValueError("Для рыночных активов нужен TWELVEDATA_API_KEY")
    symbol = (asset.tracking_symbol or asset.tracking_external_id or asset.symbol or "").upper()
    if not symbol:
        raise ValueError("Для актива нужен символ провайдера")
    payload = _http_get_json(
        settings.twelvedata_base_url.rstrip("/") + "/time_series",
        params={
            "symbol": symbol,
            "interval": "1day",
            "outputsize": min(max(range_days, 7), 365),
            "apikey": api_key,
        },
    )
    values = payload.get("values", [])
    quote_currency = _infer_quote_currency(asset, symbol)
    conversion_rate = (
        1.0
        if asset.type == AssetType.CASH or quote_currency == base_currency.upper()
        else _convert_with_twelvedata(1.0, quote_currency, base_currency)
    )
    points: list[ChartPoint] = []
    for row in reversed(values):
        point_date = date.fromisoformat(str(row.get("datetime")).split(" ")[0])
        close_price = float(row.get("close") or 0)
        if asset.type == AssetType.CASH:
            points.append(ChartPoint(date=point_date, price=1.0, price_in_base=close_price))
            continue
        close_in_base = close_price if quote_currency == base_currency.upper() else close_price * conversion_rate
        points.append(ChartPoint(date=point_date, price=close_price, price_in_base=close_in_base))
    return points


def _fetch_twelvedata_price(symbol: str) -> float:
    payload = _http_get_json(
        settings.twelvedata_base_url.rstrip("/") + "/price",
        params={"symbol": symbol, "apikey": settings.twelvedata_api_key},
    )
    return float(payload.get("price") or 0)


def _infer_quote_currency(asset: Asset, symbol: str) -> str:
    if "/" in symbol:
        parts = symbol.split("/")
        return parts[1].upper()
    return asset.currency.upper()


def _convert_with_twelvedata(value: float, from_currency: str, to_currency: str) -> float:
    if from_currency.upper() == to_currency.upper():
        return round(value, 6)
    api_key = settings.twelvedata_api_key
    if not api_key:
        return round(value, 6)
    payload = _http_get_json(
        settings.twelvedata_base_url.rstrip("/") + "/currency_conversion",
        params={
            "symbol": f"{from_currency.upper()}/{to_currency.upper()}",
            "amount": value,
            "apikey": api_key,
        },
    )
    return round(float(payload.get("amount") or payload.get("value") or value), 6)


def _http_get_json(url: str, params: dict[str, Any], headers: dict[str, str] | None = None) -> dict[str, Any]:
    with httpx.Client(timeout=15) as client:
        response = client.get(url, params=params, headers=headers)
        response.raise_for_status()
        return response.json()


def _coingecko_headers() -> dict[str, str] | None:
    if not settings.coingecko_api_key:
        return None
    return {"x-cg-pro-api-key": settings.coingecko_api_key}
