from datetime import date, datetime
import re
from urllib.parse import urljoin

import pdfplumber
import requests
from bs4 import BeautifulSoup


class ScheduleScraper:
    SUBJECT_NORMALIZATIONS = {
        "PROG": "Prog.",
        "RDITD": "RDiTD",
        "SR": "SR",
        "MAT": "Mat.",
        "TIPUIK": "TiPUiK",
        "E": "Eti.",
        "MPIR": "MPiR",
        "PRI (G)": "Geo.",
        "ENG": "Eng.",
        "UURM": "UuRM",
        "OMUR": "OMuR",
        "HRV": "Hrv.",
    }

    def __init__(self, url: str, timeout: tuple[int, int] = (5, 20)):
        self.url = url
        self.timeout = timeout
        self.last_success: datetime | None = None
        self.last_error: str | None = None
        self.notices: list[dict] = []

    def scrape(self) -> list[dict]:
        try:
            response = requests.get(self.url, timeout=self.timeout, headers={"User-Agent": "TSRB-2F-Dashboard/1.0"})
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")
            document_iframe = soup.select_one('iframe[src*="docs.google.com/document"]')
            if document_iframe:
                document_response = requests.get(document_iframe["src"], timeout=self.timeout, headers={"User-Agent": "TSRB-2F-Dashboard/1.0"})
                document_response.raise_for_status()
                notices = self._extract_2f_tables(document_response.text, document_response.url)
                self.notices = notices
                self.last_success = datetime.now().astimezone()
                self.last_error = None
                return notices
            links = [urljoin(self.url, tag["href"]) for tag in soup.select("a[href]") if ".pdf" in tag["href"].lower()]
            if not links:
                raise ValueError("No schedule PDF links discovered on upstream page")
            notices = []
            for link in links[:10]:
                pdf_response = requests.get(link, timeout=self.timeout, headers={"User-Agent": "TSRB-2F-Dashboard/1.0"})
                pdf_response.raise_for_status()
                with pdfplumber.open(__import__("io").BytesIO(pdf_response.content)) as pdf:
                    text = "\n".join(page.extract_text() or "" for page in pdf.pages)
                notices.extend(self._extract_2f(text, link))
            self.notices = notices
            self.last_success = datetime.now().astimezone()
            self.last_error = None
        except (requests.RequestException, OSError, ValueError) as exc:
            self.last_error = str(exc)
        return self.notices

    @classmethod
    def _extract_2f_tables(cls, html: str, source: str) -> list[dict]:
        soup = BeautifulSoup(html, "html.parser")
        notices = []
        for table in soup.find_all("table"):
            rows = table.find_all("tr")
            if not rows:
                continue
            headers = [cell.get_text(" ", strip=True) for cell in rows[0].find_all(["th", "td"])]
            if not headers or headers[0].upper() not in {"POSLIJE PODNE", "UJUTRO", "PRIJE PODNE"}:
                continue
            heading = table.find_previous(string=re.compile(r"IZMJENE U RASPOREDU", re.IGNORECASE))
            change_date = cls._parse_heading_date(heading or "")
            for row in rows[1:]:
                cells = [cell.get_text(" ", strip=True) for cell in row.find_all(["th", "td"])]
                if not cells or cells[0].strip().upper() != "2.F":
                    continue
                for period, value in zip(headers[1:], cells[1:]):
                    if not value:
                        continue
                    normalized = cls._normalize_subject(value)
                    cancelled = normalized.upper() == "X"
                    notices.append({
                        "class_name": "2.F",
                        "date": change_date,
                        "shift": headers[0].strip(),
                        "period": period.strip(),
                        "kind": "cancelled" if cancelled else "replacement",
                        "subject": None if cancelled else normalized,
                        "text": f"{period.strip()}: {'otkazano' if cancelled else normalized}",
                        "source": source,
                    })
        return notices

    @classmethod
    def _normalize_subject(cls, value: str) -> str:
        key = re.sub(r"\s+", " ", value.strip()).upper()
        return cls.SUBJECT_NORMALIZATIONS.get(key, value.strip())

    @staticmethod
    def _parse_heading_date(heading: str) -> str | None:
        months = {"SIJEČNJA": 1, "VELJAČE": 2, "OŽUJKA": 3, "TRAVNJA": 4, "SVIBNJA": 5, "LIPNJA": 6, "SRPNJA": 7, "KOLOVOZA": 8, "RUJNA": 9, "LISTOPADA": 10, "STUDENOGA": 11, "PROSINCA": 12}
        match = re.search(r"(\d{1,2})\.\s*([A-ZČĆŽŠĐ]+)\s+(\d{4})", heading.upper())
        if not match:
            return None
        month = months.get(match.group(2))
        if not month:
            return None
        return date(int(match.group(3)), month, int(match.group(1))).isoformat()

    @staticmethod
    def _extract_2f(text: str, source: str) -> list[dict]:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return [{"class_name": "2.F", "text": line, "source": source} for line in lines if re.search(r"\b2\.F\b", line, re.IGNORECASE)]

    def status(self) -> dict:
        return {"last_success": self.last_success.isoformat() if self.last_success else None, "last_error": self.last_error, "notices": self.notices}
