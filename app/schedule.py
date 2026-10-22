from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday")


def shift_for_date(day: date, schedule: dict) -> str:
    parity = "odd" if day.isocalendar().week % 2 else "even"
    return schedule["shift_map"][parity]


def _periods_for(day: date, now: datetime, schedule: dict) -> list[dict]:
    weekday = day.weekday()
    if weekday >= 5:
        return []
    shift = shift_for_date(day, schedule)
    subjects = schedule["weeks"][shift][WEEKDAYS[weekday]]
    periods = []
    for bell in schedule["bell_times"]:
        subject = subjects[bell["period"] - 1] if bell["period"] - 1 < len(subjects) else "Nije potvrđeno"
        start = datetime.combine(day, time.fromisoformat(bell["start"]), now.tzinfo)
        end = datetime.combine(day, time.fromisoformat(bell["end"]), now.tzinfo)
        state = "upcoming" if now < start else "past" if now >= end else "active"
        periods.append({**bell, "subject": subject, "state": state})
    return periods


def timeline(now: datetime, schedule: dict, holidays: dict) -> dict:
    holiday = next((item for item in holidays.get("holidays", []) if item.get("date") == now.date().isoformat()), None)
    is_weekend = now.weekday() >= 5
    periods = [] if holiday or is_weekend else _periods_for(now.date(), now, schedule)
    active = next((period for period in periods if period["state"] == "active"), None)
    return {
        "date": now.date().isoformat(),
        "weekday": now.strftime("%A"),
        "shift": shift_for_date(now.date(), schedule),
        "shift_label": f"{shift_for_date(now.date(), schedule)}-Smjena",
        "is_holiday": bool(holiday),
        "holiday_name": holiday.get("name") if holiday else None,
        "is_weekend": is_weekend,
        "status": "Nema nastave" if holiday or is_weekend else "Nastava",
        "active_period": active,
        "periods": periods,
    }


def tomorrow_preview(now: datetime, schedule: dict, holidays: dict) -> dict:
    day = now.date() + timedelta(days=1)
    preview_now = datetime.combine(day, time(0), now.tzinfo)
    result = timeline(preview_now, schedule, holidays)
    result["date"] = day.isoformat()
    return result
