"""
Comprehensive Automated Test Suite for Phase 1:
- Ticker normalization & exchange routing
- NSE trading calendar, IST/UTC timezone alignment & holiday filtering
- Candlestick validity and data cleaning
- DataAlignmentQueue point-in-time synchronization
- Strict Look-Ahead Bias Prevention and Truncation Invariance
"""

from datetime import UTC, date, datetime, time

import numpy as np
import pandas as pd

from src.data.calendar import (
    IST,
    get_next_market_open,
    get_next_trading_day,
    get_trading_days,
    is_market_hours,
    is_trading_day,
    to_ist,
    to_utc,
)
from src.data.data_queue import DataAlignmentQueue
from src.data.price_fetcher import (
    generate_mock_bars,
    normalize_ticker,
    validate_candlestick,
)
from src.data.schemas import NewsArticle, PriceBar


# ---------------------------------------------------------------------------
# 1. Ticker Normalization Tests
# ---------------------------------------------------------------------------
def test_ticker_normalization() -> None:
    # Standard unadorned Indian stock symbols
    assert normalize_ticker("POWERGRID") == "POWERGRID.NS"
    assert normalize_ticker("ONGC") == "ONGC.NS"
    assert normalize_ticker("reliance") == "RELIANCE.NS"

    # Already qualified tickers
    assert normalize_ticker("INFY.NS") == "INFY.NS"
    assert normalize_ticker("TCS.BO") == "TCS.BO"

    # Canonical company renames & aliases
    assert normalize_ticker("REC") == "RECLTD.NS"
    assert normalize_ticker("ZOMATO") == "ETERNAL.NS"
    assert normalize_ticker("TATAMOTORS") == "TMPV.NS"

    # Market Indices
    assert normalize_ticker("^NSEI") == "^NSEI"
    assert normalize_ticker("^BSESN") == "^BSESN"
    assert normalize_ticker("^NSEBANK") == "^NSEBANK"
    assert normalize_ticker("^INDIAVIX") == "^INDIAVIX"


# ---------------------------------------------------------------------------
# 2. NSE Trading Calendar & Timezone Tests
# ---------------------------------------------------------------------------
def test_nse_calendar_weekends_and_holidays() -> None:
    # Saturdays and Sundays are non-trading days
    saturday = date(2024, 1, 20)
    sunday = date(2024, 1, 21)
    monday = date(2024, 1, 22)  # Special Ayodhya holiday in 2024
    tuesday = date(2024, 1, 23)

    assert not is_trading_day(saturday)
    assert not is_trading_day(sunday)
    assert not is_trading_day(monday)  # Holiday in 2024
    assert is_trading_day(tuesday)

    # National Indian holidays
    republic_day = date(2024, 1, 26)
    independence_day = date(2024, 8, 15)
    gandhi_jayanti = date(2024, 10, 2)
    christmas = date(2024, 12, 25)

    assert not is_trading_day(republic_day)
    assert not is_trading_day(independence_day)
    assert not is_trading_day(gandhi_jayanti)
    assert not is_trading_day(christmas)

    # Trading days count in January 2024:
    # 31 days - 8 weekend days - 2 holidays (Jan 22, Jan 26) = 21 trading days
    trading_days = get_trading_days(date(2024, 1, 1), date(2024, 1, 31))
    assert len(trading_days) == 21


def test_next_trading_day() -> None:
    # Friday Jan 19, 2024 -> Next trading day is Tuesday Jan 23
    # (Jan 20-21 weekend, Mon Jan 22 special Ayodhya holiday)
    friday = date(2024, 1, 19)
    next_day = get_next_trading_day(friday)
    assert next_day == date(2024, 1, 23)


def test_market_hours_and_ist_conversion() -> None:
    # 2024-01-24 is Wednesday (Active trading day)
    d = date(2024, 1, 24)

    # 09:00 IST (Pre-open) -> is_market_hours should be False
    pre_open = datetime.combine(d, time(9, 0), tzinfo=IST)
    assert not is_market_hours(pre_open)

    # 09:15 IST (Market Open) -> True
    market_open = datetime.combine(d, time(9, 15), tzinfo=IST)
    assert is_market_hours(market_open)

    # 12:30 IST (Mid-session) -> True
    mid_day = datetime.combine(d, time(12, 30), tzinfo=IST)
    assert is_market_hours(mid_day)

    # 15:30 IST (Market Close) -> True
    market_close = datetime.combine(d, time(15, 30), tzinfo=IST)
    assert is_market_hours(market_close)

    # 15:31 IST (Post close) -> False
    post_close = datetime.combine(d, time(15, 31), tzinfo=IST)
    assert not is_market_hours(post_close)

    # Sunday session -> False
    sunday_dt = datetime(2024, 1, 28, 11, 0, tzinfo=IST)
    assert not is_market_hours(sunday_dt)

    # UTC conversions
    utc_dt = to_utc(market_open)
    assert utc_dt.hour == 3
    assert utc_dt.minute == 45
    assert to_ist(utc_dt) == market_open


def test_get_next_market_open() -> None:
    # Friday evening after-market news at 18:00 IST on Jan 19, 2024
    # Next trading day is Jan 23, 2024 (Jan 20-21 weekend, Jan 22 holiday)
    friday_night = datetime(2024, 1, 19, 18, 0, tzinfo=IST)
    next_open = get_next_market_open(friday_night)

    expected_open_ist = datetime(2024, 1, 23, 9, 15, tzinfo=IST)
    assert next_open == to_utc(expected_open_ist)

    # Same day morning before open: 08:30 IST on Jan 24, 2024
    morning = datetime(2024, 1, 24, 8, 30, tzinfo=IST)
    today_open = get_next_market_open(morning)
    assert today_open == to_utc(datetime(2024, 1, 24, 9, 15, tzinfo=IST))


# ---------------------------------------------------------------------------
# 3. Candlestick Integrity & Mock Data Generator Tests
# ---------------------------------------------------------------------------
def test_validate_candlestick() -> None:
    # Valid candle
    assert validate_candlestick(100.0, 105.0, 98.0, 103.0, 10000.0)

    # Inverted High < Low
    assert not validate_candlestick(100.0, 95.0, 98.0, 103.0, 10000.0)

    # High < Open or Close
    assert not validate_candlestick(100.0, 99.0, 90.0, 95.0, 10000.0)
    assert not validate_candlestick(100.0, 101.0, 90.0, 102.0, 10000.0)

    # Low > Open or Close
    assert not validate_candlestick(100.0, 105.0, 101.0, 103.0, 10000.0)

    # Negative prices or volume
    assert not validate_candlestick(-10.0, 105.0, 98.0, 103.0, 10000.0)
    assert not validate_candlestick(100.0, 105.0, 98.0, 103.0, -50.0)


def test_mock_bars_generator() -> None:
    start_d = date(2024, 1, 1)
    end_d = date(2024, 1, 15)
    bars = generate_mock_bars("POWERGRID", start_d, end_d, interval="1d")

    assert len(bars) > 0
    for bar in bars:
        assert bar.ticker == "POWERGRID.NS"
        assert bar.timestamp.tzinfo is not None
        assert validate_candlestick(bar.open, bar.high, bar.low, bar.close, bar.volume)

    # Verify timestamps strictly increase
    for i in range(1, len(bars)):
        assert bars[i].timestamp > bars[i - 1].timestamp


# ---------------------------------------------------------------------------
# 4. DataAlignmentQueue & Zero Look-Ahead Bias Tests
# ---------------------------------------------------------------------------
def test_data_alignment_queue_temporal_ordering() -> None:
    queue = DataAlignmentQueue()

    t0 = datetime(2024, 1, 1, 3, 45, tzinfo=UTC)
    t1 = datetime(2024, 1, 2, 3, 45, tzinfo=UTC)
    t2 = datetime(2024, 1, 3, 3, 45, tzinfo=UTC)

    b0 = PriceBar(
        timestamp=t0,
        ticker="ONGC.NS",
        open=230,
        high=235,
        low=229,
        close=232,
        volume=1000,
    )
    b1 = PriceBar(
        timestamp=t1,
        ticker="ONGC.NS",
        open=232,
        high=236,
        low=231,
        close=234,
        volume=1200,
    )
    b2 = PriceBar(
        timestamp=t2,
        ticker="ONGC.NS",
        open=234,
        high=238,
        low=233,
        close=237,
        volume=1500,
    )

    # Push in reverse order
    queue.push_price(b2)
    queue.push_price(b0)
    queue.push_price(b1)

    # Consume should strictly yield t0, t1, t2
    bar_first, _ = queue.consume_next_bar()
    assert bar_first is not None and bar_first.timestamp == t0
    assert queue.current_time == t0

    bar_second, _ = queue.consume_next_bar()
    assert bar_second is not None and bar_second.timestamp == t1
    assert queue.current_time == t1

    bar_third, _ = queue.consume_next_bar()
    assert bar_third is not None and bar_third.timestamp == t2
    assert queue.current_time == t2

    # Exhausted
    bar_empty, _ = queue.consume_next_bar()
    assert bar_empty is None


def test_look_ahead_news_release_invariant() -> None:
    """
    CRITICAL RULE:
    News arriving at t_news MUST NOT be visible until a price bar with t_bar > t_news.
    """
    queue = DataAlignmentQueue()

    # Price bars at 09:15, 09:20, 09:25 IST
    t_bar0 = datetime(2024, 1, 3, 3, 45, tzinfo=UTC)  # 09:15 IST
    t_bar1 = datetime(2024, 1, 3, 3, 50, tzinfo=UTC)  # 09:20 IST
    t_bar2 = datetime(2024, 1, 3, 3, 55, tzinfo=UTC)  # 09:25 IST

    b0 = PriceBar(
        timestamp=t_bar0,
        ticker="POWERGRID.NS",
        open=269,
        high=271,
        low=268,
        close=270,
        volume=5000,
    )
    b1 = PriceBar(
        timestamp=t_bar1,
        ticker="POWERGRID.NS",
        open=270,
        high=272,
        low=269,
        close=271,
        volume=6000,
    )
    b2 = PriceBar(
        timestamp=t_bar2,
        ticker="POWERGRID.NS",
        open=271,
        high=273,
        low=270,
        close=272,
        volume=7000,
    )

    # News 1 published at 09:10 IST (before bar 0)
    t_news1 = datetime(2024, 1, 3, 3, 40, tzinfo=UTC)
    news1 = NewsArticle(
        article_id="N1",
        ticker="POWERGRID.NS",
        title="Pre-market update",
        published_at=t_news1,
        source="ET",
    )

    # News 2 published at 09:17 IST (between bar 0 and bar 1)
    t_news2 = datetime(2024, 1, 3, 3, 47, tzinfo=UTC)
    news2 = NewsArticle(
        article_id="N2",
        ticker="POWERGRID.NS",
        title="Intraday flash",
        published_at=t_news2,
        source="Moneycontrol",
    )

    # News 3 published at 09:30 IST (after bar 2)
    t_news3 = datetime(2024, 1, 3, 4, 0, tzinfo=UTC)
    news3 = NewsArticle(
        article_id="N3",
        ticker="POWERGRID.NS",
        title="Post-market news",
        published_at=t_news3,
        source="Reuters",
    )

    queue.push_batch(prices=[b0, b1, b2], news=[news1, news2, news3])

    # 1. Consume Bar 0 (09:15 IST)
    # News 1 (09:10 IST) was published before bar 0 -> RELEASED
    # News 2 (09:17 IST) was published after bar 0 -> MUST NOT BE RELEASED
    bar, released = queue.consume_next_bar()
    assert bar == b0
    assert len(released) == 1
    assert released[0].article_id == "N1"

    # 2. Consume Bar 1 (09:20 IST)
    # News 2 (09:17 IST) was published before bar 1 -> RELEASED
    # News 3 (09:30 IST) was published after bar 1 -> MUST NOT BE RELEASED
    bar, released = queue.consume_next_bar()
    assert bar == b1
    assert len(released) == 1
    assert released[0].article_id == "N2"

    # 3. Consume Bar 2 (09:25 IST)
    # News 3 (09:30 IST) was published after bar 2 -> MUST NOT BE RELEASED
    bar, released = queue.consume_next_bar()
    assert bar == b2
    assert len(released) == 0

    # 4. Queue is exhausted of price bars
    bar, released = queue.consume_next_bar()
    assert bar is None


# ---------------------------------------------------------------------------
# 5. Automated Truncation Invariance Test
# ---------------------------------------------------------------------------
def test_truncation_invariance_no_lookahead() -> None:
    """
    Test truncation invariance:
    Computing rolling features on data[:t+1] must produce the exact same value
    at index t as computing on data[:T] where T > t.
    Proves that no future rows leak backwards into earlier indices.
    """
    start_d = date(2024, 1, 1)
    end_d = date(2024, 4, 30)
    bars = generate_mock_bars("POWERGRID.NS", start_d, end_d, interval="1d")

    df = pd.DataFrame(
        [
            {
                "timestamp": b.timestamp,
                "close": b.close,
                "volume": b.volume,
            }
            for b in bars
        ]
    )

    def compute_features(data: pd.DataFrame) -> pd.DataFrame:
        # Strictly backwards-looking rolling calculations
        feat = pd.DataFrame(index=data.index)
        feat["sma_10"] = data["close"].rolling(window=10, min_periods=10).mean()
        feat["sma_20"] = data["close"].rolling(window=20, min_periods=20).mean()
        feat["vol_5"] = data["volume"].rolling(window=5, min_periods=5).mean()
        return feat

    full_features = compute_features(df)

    # Sample multiple evaluation points
    test_indices = [25, 35, 45, 55, len(df) - 2]

    for t in test_indices:
        # Truncate strictly up to index t
        truncated_df = df.iloc[: t + 1].copy()
        truncated_features = compute_features(truncated_df)

        # Value at index t must be identical
        for col in ["sma_10", "sma_20", "vol_5"]:
            full_val = full_features.iloc[t][col]
            trunc_val = truncated_features.iloc[-1][col]

            assert np.isclose(full_val, trunc_val, rtol=1e-9, equal_nan=True), (
                f"LOOK-AHEAD LEAKAGE DETECTED in '{col}' at index {t}: "
                f"full={full_val} vs truncated={trunc_val}"
            )
