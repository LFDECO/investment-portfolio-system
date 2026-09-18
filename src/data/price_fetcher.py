"""
Free Market Data Ingestion Pipeline for Indian Equities (NSE/BSE).

Fetches historical and intraday OHLCV bars using yfinance with resilient
direct HTTP fallback, enforces candlestick integrity invariants, and
normalizes all bar timestamps to timezone-aware UTC.
"""

import logging
from datetime import UTC, date, datetime, timedelta
from typing import Any, Final

import httpx
import numpy as np
import pandas as pd
import yfinance as yf

from .calendar import is_market_hours, to_utc
from .schemas import PriceBar

logger = logging.getLogger("price-fetcher")

# Corporate ticker renames (historical or updated symbols)
CORPORATE_RENAMES: Final[dict[str, str]] = {
    "REC": "RECLTD",
    "ZOMATO": "ETERNAL",
    "TATAMOTORS": "TMPV",
}

INDEX_TICKERS: Final[set[str]] = {
    "^NSEI",
    "^BSESN",
    "^NSEBANK",
    "^CNXIT",
    "^INDIAVIX",
}


def normalize_ticker(ticker: str) -> str:
    """
    Sanitize and map ticker to standard canonical exchange symbol.
    Defaults unadorned Indian tickers to the NSE (.NS) exchange.
    Preserves .BO if explicitly specified.
    """
    clean = ticker.strip().upper()
    if clean in INDEX_TICKERS:
        return clean

    suffix = ".NS"
    base = clean
    if clean.endswith(".NS") or clean.endswith(".BO"):
        suffix = clean[-3:]
        base = clean[:-3]

    # Apply corporate rename if applicable
    if base in CORPORATE_RENAMES:
        base = CORPORATE_RENAMES[base]

    return f"{base}{suffix}"


def validate_candlestick(
    open_p: float, high_p: float, low_p: float, close_p: float, volume: float
) -> bool:
    """
    Verify candlestick mathematical integrity:
    1. All prices positive
    2. High >= max(Open, Close)
    3. Low <= min(Open, Close)
    4. Volume >= 0
    """
    if open_p <= 0 or high_p <= 0 or low_p <= 0 or close_p <= 0:
        return False
    if high_p < low_p:
        return False
    if high_p < open_p or high_p < close_p:
        return False
    if low_p > open_p or low_p > close_p:
        return False
    return volume >= 0


def _fetch_direct_chart_fallback(
    ticker: str, start_dt: datetime, end_dt: datetime, interval: str
) -> list[PriceBar]:
    """
    Direct HTTP fallback to Yahoo Finance chart v8 API if yfinance fails.
    """
    canonical = normalize_ticker(ticker)
    period1 = int(start_dt.timestamp())
    period2 = int(end_dt.timestamp())

    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{canonical}"
        f"?period1={period1}&period2={period2}&interval={interval}"
    )
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, headers=headers)
            if resp.status_code != 200:
                logger.warning(
                    f"Direct chart query failed for {canonical}: HTTP {resp.status_code}"
                )
                return []
            data = resp.json()

        chart = data.get("chart", {}).get("result", [])
        if not chart:
            return []

        result_data = chart[0]
        timestamps = result_data.get("timestamp", [])
        quote = result_data.get("indicators", {}).get("quote", [{}])[0]

        opens = quote.get("open", [])
        highs = quote.get("high", [])
        lows = quote.get("low", [])
        closes = quote.get("close", [])
        volumes = quote.get("volume", [])

        bars: list[PriceBar] = []
        for i, ts in enumerate(timestamps):
            if i >= len(opens) or opens[i] is None or closes[i] is None:
                continue
            o, h, l_p, c = (
                float(opens[i]),
                float(highs[i]),
                float(lows[i]),
                float(closes[i]),
            )
            v = float(volumes[i]) if volumes[i] is not None else 0.0

            if not validate_candlestick(o, h, l_p, c, v):
                continue

            bar_ts = datetime.fromtimestamp(ts, tz=UTC)
            bars.append(
                PriceBar(
                    timestamp=bar_ts,
                    ticker=canonical,
                    open=round(o, 2),
                    high=round(h, 2),
                    low=round(l_p, 2),
                    close=round(c, 2),
                    volume=v,
                )
            )
        return bars
    except Exception as e:
        logger.warning(f"Direct fallback request error for {canonical}: {e}")
        return []


def generate_mock_bars(
    ticker: str,
    start: date,
    end: date,
    interval: str = "1d",
    base_price: float = 250.0,
    seed: int = 42,
) -> list[PriceBar]:
    """
    Generate deterministic, mathematically valid synthetic OHLCV bars
    for offline testing and zero-network reproducible simulation.
    """
    canonical = normalize_ticker(ticker)
    from .calendar import is_trading_day

    rng = np.random.default_rng(seed)
    bars: list[PriceBar] = []

    curr_date = start
    curr_price = base_price

    while curr_date <= end:
        if not is_trading_day(curr_date):
            curr_date += timedelta(days=1)
            continue

        if interval == "1d":
            # 1 bar per day at 09:15 IST (03:45 UTC)
            bar_ts = datetime(
                curr_date.year,
                curr_date.month,
                curr_date.day,
                3,
                45,
                tzinfo=UTC,
            )
            change_pct = rng.normal(0.0005, 0.015)
            open_p = curr_price
            close_p = max(5.0, open_p * (1.0 + change_pct))
            high_p = max(open_p, close_p) * (1.0 + abs(rng.normal(0.002, 0.005)))
            low_p = min(open_p, close_p) * (1.0 - abs(rng.normal(0.002, 0.005)))
            volume = float(rng.integers(100_000, 5_000_000))

            bars.append(
                PriceBar(
                    timestamp=bar_ts,
                    ticker=canonical,
                    open=round(open_p, 2),
                    high=round(high_p, 2),
                    low=round(low_p, 2),
                    close=round(close_p, 2),
                    volume=volume,
                )
            )
            curr_price = close_p
        elif interval in ("5m", "15m"):
            # Intraday bars from 09:15 to 15:30 IST
            mins_step = 5 if interval == "5m" else 15
            current_time = datetime(
                curr_date.year,
                curr_date.month,
                curr_date.day,
                3,
                45,
                tzinfo=UTC,
            )
            end_time = datetime(
                curr_date.year,
                curr_date.month,
                curr_date.day,
                10,
                0,
                tzinfo=UTC,
            )

            while current_time < end_time:
                change_pct = rng.normal(0.0001, 0.003)
                open_p = curr_price
                close_p = max(5.0, open_p * (1.0 + change_pct))
                high_p = max(open_p, close_p) * (1.0 + abs(rng.normal(0.0005, 0.001)))
                low_p = min(open_p, close_p) * (1.0 - abs(rng.normal(0.0005, 0.001)))
                volume = float(rng.integers(5_000, 200_000))

                bars.append(
                    PriceBar(
                        timestamp=current_time,
                        ticker=canonical,
                        open=round(open_p, 2),
                        high=round(high_p, 2),
                        low=round(low_p, 2),
                        close=round(close_p, 2),
                        volume=volume,
                    )
                )
                curr_price = close_p
                current_time += timedelta(minutes=mins_step)

        curr_date += timedelta(days=1)

    return bars


def fetch_ohlcv(
    ticker: str,
    start: str | date | datetime,
    end: str | date | datetime,
    interval: str = "1d",
    auto_adjust: bool = True,
    use_fallback: bool = True,
) -> list[PriceBar]:
    """
    Fetch and normalize OHLCV candlestick bars for an Indian stock.

    Args:
        ticker: Symbol string (e.g. 'POWERGRID', 'ONGC.NS', '^NSEI').
        start: Start boundary string ('YYYY-MM-DD') or date/datetime.
        end: End boundary string ('YYYY-MM-DD') or date/datetime.
        interval: Bar size: '1m', '5m', '15m', '1h', '1d'.
        auto_adjust: True to return split- and dividend-adjusted bars.
        use_fallback: Whether to attempt direct HTTP or mock generation on error.

    Returns:
        Ordered list of validated PriceBar objects strictly timestamped in UTC.
    """
    canonical = normalize_ticker(ticker)

    # Normalize boundaries to datetime
    if isinstance(start, str):
        start_dt = datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=UTC)
    elif isinstance(start, date) and not isinstance(start, datetime):
        start_dt = datetime(start.year, start.month, start.day, tzinfo=UTC)
    else:
        start_dt = to_utc(start)

    if isinstance(end, str):
        end_dt = datetime.strptime(end, "%Y-%m-%d").replace(tzinfo=UTC)
    elif isinstance(end, date) and not isinstance(end, datetime):
        end_dt = datetime(end.year, end.month, end.day, tzinfo=UTC)
    else:
        end_dt = to_utc(end)

    bars: list[PriceBar] = []

    try:
        stock = yf.Ticker(canonical)
        start_str = start_dt.strftime("%Y-%m-%d")
        end_str = end_dt.strftime("%Y-%m-%d")
        df: pd.DataFrame = stock.history(
            start=start_str,
            end=end_str,
            interval=interval,
            auto_adjust=auto_adjust,
        )

        if df is not None and not df.empty:
            for idx, row in df.iterrows():
                # Check for NaNs
                if (
                    pd.isna(row.get("Open"))
                    or pd.isna(row.get("High"))
                    or pd.isna(row.get("Low"))
                    or pd.isna(row.get("Close"))
                ):
                    continue

                o = float(row["Open"])
                h = float(row["High"])
                l_p = float(row["Low"])
                c = float(row["Close"])
                v = float(row["Volume"]) if not pd.isna(row.get("Volume")) else 0.0

                if not validate_candlestick(o, h, l_p, c, v):
                    continue

                # Ensure UTC timestamp
                raw_ts: Any = idx
                if hasattr(raw_ts, "to_pydatetime"):
                    pydt = raw_ts.to_pydatetime()
                elif isinstance(raw_ts, datetime):
                    pydt = raw_ts
                else:
                    pydt = pd.to_datetime(raw_ts).to_pydatetime()

                bar_ts = to_utc(pydt)

                # Filter intraday off-hours if applicable
                if interval in ("1m", "5m", "15m", "1h") and not is_market_hours(bar_ts):
                    continue

                bars.append(
                    PriceBar(
                        timestamp=bar_ts,
                        ticker=canonical,
                        open=round(o, 2),
                        high=round(h, 2),
                        low=round(l_p, 2),
                        close=round(c, 2),
                        volume=v,
                    )
                )
    except Exception as e:
        logger.warning(f"yfinance query failed for {canonical}: {e}")

    # If yfinance returned no bars, attempt fallback
    if not bars and use_fallback:
        logger.info(f"Attempting direct HTTP fallback for {canonical}...")
        bars = _fetch_direct_chart_fallback(canonical, start_dt, end_dt, interval)

    # Sort strictly by timestamp to guarantee non-decreasing chronological order
    bars.sort(key=lambda b: b.timestamp)
    return bars


def fetch_historical_daily(ticker: str, start: str | date, end: str | date) -> list[PriceBar]:
    """Fetch daily OHLCV bars for an Indian ticker."""
    return fetch_ohlcv(ticker, start=start, end=end, interval="1d")


def fetch_intraday_bars(
    ticker: str, start: str | date, end: str | date, interval: str = "5m"
) -> list[PriceBar]:
    """Fetch intraday OHLCV bars (5m, 15m) for an Indian ticker."""
    return fetch_ohlcv(ticker, start=start, end=end, interval=interval)


def fetch_liquid_universe(
    tickers: list[str],
    start: str | date,
    end: str | date,
    interval: str = "1d",
) -> dict[str, list[PriceBar]]:
    """Fetch OHLCV bars for a collection of symbols."""
    results: dict[str, list[PriceBar]] = {}
    for t in tickers:
        canonical = normalize_ticker(t)
        results[canonical] = fetch_ohlcv(canonical, start, end, interval=interval)
    return results
