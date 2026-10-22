from pathlib import Path
import json
import os

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
SCHEDULE_PATH = Path(os.getenv("TSRB_SCHEDULE_PATH", DATA_DIR / "schedules.json"))
HOLIDAY_PATH = Path(os.getenv("TSRB_HOLIDAY_PATH", DATA_DIR / "holidays.json"))
TIMEZONE = os.getenv("TSRB_TIMEZONE", "Europe/Zagreb")
UPSTREAM_URL = os.getenv("TSRB_UPSTREAM_URL", "https://tsrb.hr/b-smjena/")
SCRAPE_INTERVAL_SECONDS = int(os.getenv("TSRB_SCRAPE_INTERVAL", "300"))


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as file:
        return json.load(file)
