import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from zoneinfo import ZoneInfo

from .config import HOLIDAY_PATH, SCHEDULE_PATH, SCRAPE_INTERVAL_SECONDS, TIMEZONE, UPSTREAM_URL, load_json
from .schedule import timeline, tomorrow_preview
from .scraper import ScheduleScraper

scraper = ScheduleScraper(UPSTREAM_URL)


async def scrape_loop() -> None:
    while True:
        await asyncio.to_thread(scraper.scrape)
        await asyncio.sleep(SCRAPE_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(scrape_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="TSRB 2.F Dashboard", version="1.0.0", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=Path(__file__).parent.parent / "static"), name="static")


@app.middleware("http")
async def disable_preview_cache(request: Request, call_next):
    response = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
    return response


def dashboard_data() -> tuple[dict, dict]:
    return load_json(SCHEDULE_PATH), load_json(HOLIDAY_PATH)


def now_local() -> datetime:
    return datetime.now(ZoneInfo(TIMEZONE))


@app.get("/")
def index() -> FileResponse:
    return FileResponse(Path(__file__).parent.parent / "static" / "index.html")


@app.get("/api/today")
def today() -> dict:
    schedule, holidays = dashboard_data()
    return {"class_name": schedule["class_name"], "timezone": TIMEZONE, **timeline(now_local(), schedule, holidays)}


@app.get("/api/schedule")
def full_schedule() -> dict:
    schedule, _ = dashboard_data()
    return {"class_name": schedule["class_name"], "bell_times": schedule["bell_times"], "striped_periods": schedule.get("striped_periods", {}), "group_labels": schedule.get("group_labels", {}), "fortnight_groups": schedule.get("fortnight_groups", {}), "weeks": schedule["weeks"]}


@app.get("/api/tomorrow")
def tomorrow() -> dict:
    schedule, holidays = dashboard_data()
    return {"class_name": schedule["class_name"], "timezone": TIMEZONE, **tomorrow_preview(now_local(), schedule, holidays)}


@app.get("/api/holidays")
def holiday_list() -> dict:
    _, holidays = dashboard_data()
    return holidays


@app.get("/api/notices")
def notices() -> dict:
    return scraper.status()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "timezone": TIMEZONE, "upstream": UPSTREAM_URL, "scraper": scraper.status()}
