"""
NSE Trading Calendar and IST (UTC+5:30) Timezone Alignment.

Enforces Indian equities trading hours (09:15 - 15:30 IST), holiday schedules,
and strict UTC/IST conversions for point-in-time quantitative simulations.
"""

import zoneinfo
from datetime import date, datetime, time, timedelta
from typing import Final

IST: Final[zoneinfo.ZoneInfo] = zoneinfo.ZoneInfo("Asia/Kolkata")
UTC: Final[zoneinfo.ZoneInfo] = zoneinfo.ZoneInfo("UTC")

PRE_OPEN_TIME: Final[time] = time(9, 0)
MARKET_OPEN_TIME: Final[time] = time(9, 15)
INTRADAY_SQUARE_OFF_TIME: Final[time] = time(15, 15)
MARKET_CLOSE_TIME: Final[time] = time(15, 30)

# Official NSE trading holidays (2023 - 2026)
NSE_HOLIDAYS: Final[set[date]] = {
    # 2023
    date(2023, 1, 26),  # Republic Day
    date(2023, 3, 7),  # Holi
    date(2023, 3, 30),  # Ram Navami
    date(2023, 4, 4),  # Mahavir Jayanti
    date(2023, 4, 7),  # Good Friday
    date(2023, 4, 14),  # Dr. Baba Saheb Ambedkar Jayanti
    date(2023, 4, 21),  # Id-Ul-Fitr (Ramzan Id)
    date(2023, 5, 1),  # Maharashtra Day
    date(2023, 6, 29),  # Bakri Id / Eid ul-Adha
    date(2023, 8, 15),  # Independence Day
    date(2023, 9, 19),  # Ganesh Chaturthi
    date(2023, 10, 2),  # Mahatma Gandhi Jayanti
    date(2023, 10, 24),  # Dussehra
    date(2023, 11, 14),  # Diwali-Balipratipada
    date(2023, 11, 27),  # Gurunanak Jayanti
    date(2023, 12, 25),  # Christmas
    # 2024
    date(2024, 1, 22),  # Special Holiday (Ayodhya Consecration)
    date(2024, 1, 26),  # Republic Day
    date(2024, 3, 8),  # Mahashivratri
    date(2024, 3, 25),  # Holi
    date(2024, 3, 29),  # Good Friday
    date(2024, 4, 11),  # Id-Ul-Fitr (Ramzan Id)
    date(2024, 4, 17),  # Shri Ram Navami
    date(2024, 5, 1),  # Maharashtra Day
    date(2024, 5, 20),  # General Parliamentary Elections (Mumbai)
    date(2024, 6, 17),  # Bakri Id
    date(2024, 7, 17),  # Muharram
    date(2024, 8, 15),  # Independence Day
    date(2024, 10, 2),  # Mahatma Gandhi Jayanti
    date(2024, 11, 1),  # Diwali Laxmi Pujan (Regular closed, Muhurat session separate)
    date(2024, 11, 15),  # Guru Nanak Jayanti
    date(2024, 11, 20),  # Maharashtra Assembly Elections
    date(2024, 12, 25),  # Christmas
    # 2025
    date(2025, 2, 26),  # Mahashivratri
    date(2025, 3, 14),  # Holi
    date(2025, 3, 31),  # Id-Ul-Fitr (Ramzan Id)
    date(2025, 4, 10),  # Mahavir Jayanti
    date(2025, 4, 14),  # Dr. Baba Saheb Ambedkar Jayanti
    date(2025, 4, 18),  # Good Friday
    date(2025, 5, 1),  # Maharashtra Day
    date(2025, 6, 6),  # Bakri Id
    date(2025, 7, 7),  # Muharram
    date(2025, 8, 15),  # Independence Day
    date(2025, 8, 27),  # Ganesh Chaturthi
    date(2025, 10, 2),  # Mahatma Gandhi Jayanti / Dussehra
    date(2025, 10, 21),  # Diwali Laxmi Pujan
    date(2025, 10, 22),  # Diwali-Balipratipada
    date(2025, 11, 5),  # Prakash Gurpurb Sri Guru Nanak Dev
    date(2025, 12, 25),  # Christmas
    # 2026
    date(2026, 1, 26),  # Republic Day
    date(2026, 3, 4),  # Holi
    date(2026, 3, 20),  # Id-Ul-Fitr (Ramzan Id)
    date(2026, 4, 3),  # Good Friday
    date(2026, 4, 14),  # Dr. Baba Saheb Ambedkar Jayanti
    date(2026, 5, 1),  # Maharashtra Day
    date(2026, 5, 27),  # Bakri Id
    date(2026, 6, 26),  # Muharram
    date(2026, 8, 15),  # Independence Day (Saturday)
    date(2026, 10, 2),  # Mahatma Gandhi Jayanti
    date(2026, 10, 20),  # Dussehra
    date(2026, 11, 9),  # Diwali Laxmi Pujan
    date(2026, 11, 10),  # Diwali-Balipratipada
    date(2026, 11, 24),  # Guru Nanak Jayanti
    date(2026, 12, 25),  # Christmas
}


# Calendar coverage horizon bounds
MIN_COVERED_YEAR: Final[int] = 2023
MAX_COVERED_YEAR: Final[int] = 2026


def to_utc(dt: datetime) -> datetime:
    """Convert any naive or aware datetime to timezone-aware UTC datetime."""
    if dt.tzinfo is None:
        # Default naive datetime to IST if not specified, then convert to UTC
        dt = dt.replace(tzinfo=IST)
    return dt.astimezone(UTC)


def to_ist(dt: datetime) -> datetime:
    """Convert any naive or aware datetime to timezone-aware IST datetime."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(IST)


def is_trading_day(target: date | datetime) -> bool:
    """
    Check if a given date or datetime falls on an official NSE trading day.
    Excludes weekends (Saturday, Sunday) and official NSE holidays.

    Raises:
        ValueError: If target year exceeds MAX_COVERED_YEAR or precedes MIN_COVERED_YEAR,
                    ensuring the system fails loudly rather than silently misbehaving.
    """
    d = to_ist(target).date() if isinstance(target, datetime) else target

    if d.year < MIN_COVERED_YEAR or d.year > MAX_COVERED_YEAR:
        raise ValueError(
            f"NSETradingCalendar coverage is restricted to "
            f"[{MIN_COVERED_YEAR}, {MAX_COVERED_YEAR}]. "
            f"Target year {d.year} is outside verified holiday coverage. "
            f"Please register official NSE holidays for {d.year}."
        )

    # Monday=0, Sunday=6
    if d.weekday() in (5, 6):
        return False

    return d not in NSE_HOLIDAYS


def is_market_hours(dt: datetime) -> bool:
    """
    Check if the given datetime is within regular NSE trading hours:
    09:15:00 to 15:30:00 IST on an active trading day.
    """
    ist_dt = to_ist(dt)
    if not is_trading_day(ist_dt.date()):
        return False

    t = ist_dt.time()
    return MARKET_OPEN_TIME <= t <= MARKET_CLOSE_TIME


def get_trading_days(start_date: date, end_date: date) -> list[date]:
    """Return an ordered list of all active NSE trading days in [start_date, end_date]."""
    days: list[date] = []
    curr = start_date
    while curr <= end_date:
        if is_trading_day(curr):
            days.append(curr)
        curr += timedelta(days=1)
    return days


def get_next_trading_day(target: date | datetime) -> date:
    """Find the next active NSE trading day strictly after the provided date/datetime."""
    curr = to_ist(target).date() if isinstance(target, datetime) else target

    curr += timedelta(days=1)
    while not is_trading_day(curr):
        curr += timedelta(days=1)
    return curr


def get_next_market_open(dt: datetime) -> datetime:
    """
    Map an event timestamp (e.g. after-hours news or weekend post) to the NEXT
    market opening timestamp (09:15:00 IST) in timezone-aware UTC.
    If the event is before 09:15 IST on a trading day, returns 09:15 IST today.
    If the event is at or after 09:15 IST, returns the next market session open.
    """
    ist_dt = to_ist(dt)
    curr_date = ist_dt.date()

    if is_trading_day(curr_date) and ist_dt.time() < MARKET_OPEN_TIME:
        open_ist = datetime.combine(curr_date, MARKET_OPEN_TIME, tzinfo=IST)
        return to_utc(open_ist)

    next_day = get_next_trading_day(curr_date)
    open_ist = datetime.combine(next_day, MARKET_OPEN_TIME, tzinfo=IST)
    return to_utc(open_ist)


class NSETradingCalendar:
    """
    Encapsulated NSE trading calendar helper for simulation clock management.
    """

    @staticmethod
    def is_holiday(d: date) -> bool:
        return d in NSE_HOLIDAYS

    @staticmethod
    def is_trading_day(target: date | datetime) -> bool:
        return is_trading_day(target)

    @staticmethod
    def is_market_hours(dt: datetime) -> bool:
        return is_market_hours(dt)

    @staticmethod
    def get_trading_days(start: date, end: date) -> list[date]:
        return get_trading_days(start, end)

    @staticmethod
    def next_trading_day(target: date | datetime) -> date:
        return get_next_trading_day(target)

    @staticmethod
    def next_market_open(dt: datetime) -> datetime:
        return get_next_market_open(dt)

    @staticmethod
    def session_bounds_utc(d: date) -> tuple[datetime, datetime]:
        """Return (market_open, market_close) in UTC for a specific trading day."""
        open_ist = datetime.combine(d, MARKET_OPEN_TIME, tzinfo=IST)
        close_ist = datetime.combine(d, MARKET_CLOSE_TIME, tzinfo=IST)
        return to_utc(open_ist), to_utc(close_ist)
