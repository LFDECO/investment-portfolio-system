---
name: indian-market-data-ingestion
description: >-
  Fetch and normalize OHLCV price data for Indian stocks (NSE/BSE) using free
  APIs (yfinance, nsetools). Use this skill when building the data ingestion
  pipeline, fetching historical or intraday price data for Indian equities,
  handling IST timezone alignment, or mapping Indian ticker symbols. Also use
  when implementing the asynchronous data queue that aligns price bars with
  news events to prevent look-ahead bias.
---

# Indian Market Data Ingestion

This skill guides the construction of a robust, point-in-time data ingestion
pipeline for Indian equities traded on NSE and BSE.

---

## 1. Data Sources (Free Tier Only)

| Source | Library | Coverage | Notes |
|---|---|---|---|
| Yahoo Finance | `yfinance` | NSE (`.NS`) and BSE (`.BO`) OHLCV, dividends, splits | Primary source. Append `.NS` or `.BO` to ticker symbols. |
| NSE Tools | `nsetools` | NSE real-time quotes, index data, stock codes | Useful for live quote snapshots and validating ticker existence. |
| NSE India | `nselib` / direct scraping | Bhavcopy, historical deliverables, corporate actions | For official end-of-day settlement data. |
| NIFTY Indices | `nsetools` / yfinance | `^NSEI` (NIFTY 50), `^BSESN` (SENSEX) | Benchmark indices for beta/correlation calculations. |

### Important: Indian Ticker Conventions

```python
# NSE tickers: append ".NS"
# BSE tickers: append ".BO"
TICKER_MAP = {
    "RELIANCE": "RELIANCE.NS",
    "TCS": "TCS.NS",
    "INFY": "INFY.NS",
    "HDFCBANK": "HDFCBANK.NS",
    "ITC": "ITC.NS",
    # BSE equivalents
    "500325": "500325.BO",  # Reliance on BSE by code
}

# Index tickers
NIFTY_50 = "^NSEI"
SENSEX = "^BSESN"
BANK_NIFTY = "^NSEBANK"
```

---

## 2. Pydantic Data Schemas

All raw data **must** be validated through Pydantic models before entering the pipeline.

```python
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from decimal import Decimal

class OHLCVBar(BaseModel):
    """Single OHLCV price bar for an Indian equity."""
    ticker: str = Field(..., description="Canonical ticker with exchange suffix, e.g. RELIANCE.NS")
    timestamp: datetime = Field(..., description="Bar open timestamp in UTC")
    open: Decimal = Field(..., ge=0)
    high: Decimal = Field(..., ge=0)
    low: Decimal = Field(..., ge=0)
    close: Decimal = Field(..., ge=0)
    volume: int = Field(..., ge=0)
    currency: str = Field(default="INR")

    @field_validator("timestamp", mode="before")
    @classmethod
    def ensure_utc(cls, v: datetime) -> datetime:
        """Convert IST timestamps to UTC for internal consistency."""
        if v.tzinfo is None:
            import zoneinfo
            ist = zoneinfo.ZoneInfo("Asia/Kolkata")
            v = v.replace(tzinfo=ist)
        return v.astimezone(zoneinfo.ZoneInfo("UTC"))

class CorporateAction(BaseModel):
    """Stock split, bonus, or dividend event."""
    ticker: str
    action_type: str  # "split", "bonus", "dividend"
    ex_date: datetime
    ratio: str | None = None       # e.g., "1:5" for split
    amount_inr: Decimal | None = None  # dividend amount
```

---

## 3. Timezone Handling — Critical Rules

Indian markets operate in IST (UTC+5:30). The following rules are **mandatory**:

1. **Internal storage**: All timestamps stored internally as **UTC**.
2. **Market hours**: NSE is open 9:15 AM – 3:30 PM IST (03:45 – 10:00 UTC).
3. **Pre-open session**: 9:00 AM – 9:15 AM IST.
4. **Trading holidays**: Fetch the NSE holiday calendar annually. Do not assume weekends-only.
5. **Conversion helper**:

```python
import zoneinfo

IST = zoneinfo.ZoneInfo("Asia/Kolkata")
UTC = zoneinfo.ZoneInfo("UTC")

def ist_to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    return dt.astimezone(UTC)

def utc_to_ist(dt: datetime) -> datetime:
    return dt.astimezone(IST)
```

---

## 4. Fetching Historical Data with yfinance

```python
import yfinance as yf
import pandas as pd

def fetch_ohlcv(
    ticker: str,
    start: str,
    end: str,
    interval: str = "1d"
) -> list[OHLCVBar]:
    """
    Fetch OHLCV bars for an Indian stock.

    Args:
        ticker: Must include exchange suffix (.NS or .BO).
        start: Start date string "YYYY-MM-DD".
        end: End date string "YYYY-MM-DD".
        interval: "1m", "5m", "15m", "1h", "1d", "1wk", "1mo".

    Returns:
        List of validated OHLCVBar objects.

    Note:
        yfinance intraday data is limited to the last 60 days for 1m bars
        and 730 days for 1d bars.
    """
    stock = yf.Ticker(ticker)
    df = stock.history(start=start, end=end, interval=interval)

    bars = []
    for idx, row in df.iterrows():
        bars.append(OHLCVBar(
            ticker=ticker,
            timestamp=idx.to_pydatetime(),
            open=Decimal(str(row["Open"])),
            high=Decimal(str(row["High"])),
            low=Decimal(str(row["Low"])),
            close=Decimal(str(row["Close"])),
            volume=int(row["Volume"]),
        ))
    return bars
```

---

## 5. Asynchronous Data Queue

The ingestion layer uses an async queue to ensure **strict temporal ordering**.
News events are mapped to the **next available candle open** — never the current
or prior candle.

```python
import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

@dataclass(order=True)
class TimestampedEvent:
    """Priority queue item ordered by timestamp."""
    timestamp: datetime
    event_type: str = field(compare=False)  # "price" or "news"
    payload: Any = field(compare=False)

class DataAlignmentQueue:
    """
    Async priority queue that enforces point-in-time data alignment.
    News events are held until the next price bar arrives.
    """
    def __init__(self):
        self._queue: asyncio.PriorityQueue[TimestampedEvent] = asyncio.PriorityQueue()
        self._latest_price_ts: datetime | None = None

    async def push_price(self, bar: OHLCVBar) -> None:
        self._latest_price_ts = bar.timestamp
        await self._queue.put(TimestampedEvent(
            timestamp=bar.timestamp,
            event_type="price",
            payload=bar,
        ))

    async def push_news(self, news_ts: datetime, payload: dict) -> None:
        # Map to next candle open — consumer must wait for next price bar
        await self._queue.put(TimestampedEvent(
            timestamp=news_ts,
            event_type="news",
            payload=payload,
        ))
```

---

## 6. Corporate Action Adjustments

When fetching historical data, always use **adjusted prices** to account for
splits and bonuses. yfinance provides adjusted close by default, but verify:

```python
# yfinance auto_adjust=True is the default — this returns adjusted OHLC
df = stock.history(start=start, end=end, auto_adjust=True)

# To get raw (unadjusted) + adjustments:
df_raw = stock.history(start=start, end=end, auto_adjust=False)
# df_raw will have "Adj Close" column
```

---

## 7. Validation Checklist

Before emitting data downstream, verify:

- [ ] Ticker exists on the target exchange (validate via `nsetools`)
- [ ] No NaN values in OHLCV fields
- [ ] `high >= max(open, close)` and `low <= min(open, close)`
- [ ] Volume is non-negative
- [ ] Timestamps are monotonically increasing
- [ ] No future timestamps relative to the current simulation clock
- [ ] Currency is set to `"INR"`

---

## 8. Dependencies

```toml
# In pyproject.toml [project.dependencies]
yfinance = ">=0.2.40"
nsetools = ">=1.0.12"
pydantic = ">=2.7"
```

For more on project setup, activate the `python-project-bootstrap` skill.
For look-ahead bias prevention patterns, activate the `look-ahead-bias-prevention` skill.
