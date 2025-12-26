from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import FastAPI, HTTPException, Request

app = FastAPI()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


def _aware_now(tz_name: str) -> datetime:
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(status_code=400, detail=f"Unknown timezone: {tz_name}") from exc
    return datetime.now(tz)


@app.get("/api/current/{tz:path}")
def current_time(tz: str) -> dict:
    now = _aware_now(tz)
    iso_value = now.isoformat()
    formatted = now.strftime("%Y-%m-%d %H:%M:%S")
    return {
        "timezone": tz,
        "iso": iso_value,
        "ISO": iso_value,
        "time": formatted,
        "epoch": int(now.timestamp()),
    }


def _parse_input_datetime(raw_dt: str, tz_name: str) -> datetime:
    normalized = raw_dt.replace(" ", "T", 1)
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid datetime format") from exc
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(status_code=400, detail=f"Unknown timezone: {tz_name}") from exc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=tz)
    else:
        dt = dt.astimezone(tz)
    return dt


@app.post("/api/convert")
async def convert_time(request: Request) -> dict:
    data = await request.json()
    for key in ("dt", "from", "to"):
        if key not in data:
            raise HTTPException(status_code=400, detail=f"Missing field: {key}")

    raw_dt = data["dt"]
    from_tz = data["from"]
    to_tz = data["to"]

    source_dt = _parse_input_datetime(raw_dt, from_tz)
    try:
        target_zone = ZoneInfo(to_tz)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(status_code=400, detail=f"Unknown timezone: {to_tz}") from exc

    converted = source_dt.astimezone(target_zone)
    iso_value = converted.isoformat()
    return {
        "input": raw_dt,
        "from": from_tz,
        "to": to_tz,
        "iso": iso_value,
        "ISO": iso_value,
        "epoch": int(converted.timestamp()),
    }
