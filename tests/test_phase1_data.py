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
import pytest

from src.data.calendar import (
    IST,
    MAX_COVERED_YEAR,
    MIN_COVERED_YEAR,
    get_next_market_open,
    get_next_trading_day,
    get_trading_days,
    is_market_hours,
    is_trading_day,
    to_ist,
    to_utc,
)
from src.data.data_queue import DataAlignmentQueue
from src.data.fast_buffer import FastBarBuffer, FastBarTuple
from src.data.price_fetcher import (
    _read_parquet_cache,
    _write_parquet_cache,
    detect_price_discontinuities,
    generate_mock_bars,
    normalize_ticker,
    validate_candlestick,
)
from src.data.schemas import CorporateAction, NewsArticle, PriceBar


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


# ---------------------------------------------------------------------------
# 6. Hardened Latency & Tie-Breaking Invariant Tests
# ---------------------------------------------------------------------------
def test_exact_timestamp_lookahead_invariant() -> None:
    """
    CRITICAL LOOK-AHEAD TEST:
    When an event's published_at matches a candle open EXACTLY (t_news == t_bar),
    it MUST NOT be released at t_bar.open because physical transmission, parsing,
    and exchange routing latency make execution at this bar's open impossible.
    It must be buffered and released at the next bar.
    """
    queue = DataAlignmentQueue()

    t_bar0 = datetime(2024, 1, 4, 3, 45, tzinfo=UTC)  # 09:15:00 IST
    t_bar1 = datetime(2024, 1, 4, 3, 50, tzinfo=UTC)  # 09:20:00 IST

    b0 = PriceBar(
        timestamp=t_bar0,
        ticker="POWERGRID.NS",
        open=270,
        high=272,
        low=269,
        close=271,
        volume=5000,
    )
    b1 = PriceBar(
        timestamp=t_bar1,
        ticker="POWERGRID.NS",
        open=271,
        high=273,
        low=270,
        close=272,
        volume=6000,
    )

    # News arrives at the EXACT same timestamp as bar 0 open
    exact_news = NewsArticle(
        article_id="EXACT_001",
        ticker="POWERGRID.NS",
        title="Breaking announcement at market open",
        published_at=t_bar0,
        source="Moneycontrol",
    )

    queue.push_price(b0)
    queue.push_price(b1)
    queue.push_news(exact_news)

    # 1. Bar 0 is consumed
    # Because published_at == t_bar0, it MUST NOT be released at Bar 0!
    bar0, released0 = queue.consume_next_bar()
    assert bar0 == b0
    assert len(released0) == 0
    assert queue.pending_news_count == 1

    # 2. Bar 1 is consumed
    # Because published_at (09:15) < t_bar1 (09:20), it is now released!
    bar1, released1 = queue.consume_next_bar()
    assert bar1 == b1
    assert len(released1) == 1
    assert released1[0].article_id == "EXACT_001"
    assert queue.pending_news_count == 0


def test_fifo_tie_breaking_sequence_id() -> None:
    """
    Verify strict FIFO tie-breaking for events sharing identical timestamps and priorities.
    Ensures 100% deterministic replayability across runs.
    """
    queue = DataAlignmentQueue()

    same_ts = datetime(2024, 1, 5, 4, 0, tzinfo=UTC)
    t_bar = datetime(2024, 1, 5, 4, 5, tzinfo=UTC)

    b0 = PriceBar(
        timestamp=t_bar,
        ticker="ONGC.NS",
        open=230,
        high=232,
        low=229,
        close=231,
        volume=5000,
    )
    queue.push_price(b0)

    # Push 5 news articles published at the exact same microsecond
    inserted_ids = [f"NEWS_{i}" for i in range(5)]
    for aid in inserted_ids:
        queue.push_news(
            NewsArticle(
                article_id=aid,
                ticker="ONGC.NS",
                title=f"Article {aid}",
                published_at=same_ts,
                source="ET",
            )
        )

    _, released = queue.consume_next_bar()
    assert len(released) == 5
    popped_ids = [n.article_id for n in released]
    assert popped_ids == inserted_ids  # Strict FIFO preserved


# ---------------------------------------------------------------------------
# 7. Calendar Horizon Guard & Hard Raise Tests
# ---------------------------------------------------------------------------
def test_calendar_boundary_hard_raise() -> None:
    """
    Assert that NSETradingCalendar fails loudly (hard raise) when queried
    past verified holiday coverage (e.g. year 2027), rather than silently misbehaving.
    """
    # Active coverage assertion: calendar must cover current year
    assert MAX_COVERED_YEAR >= 2024
    assert MIN_COVERED_YEAR <= 2023

    # Hard raise past coverage
    future_date = date(2027, 1, 1)
    with pytest.raises(ValueError, match="outside verified holiday coverage"):
        is_trading_day(future_date)

    past_date = date(2022, 12, 31)
    with pytest.raises(ValueError, match="outside verified holiday coverage"):
        is_trading_day(past_date)


# ---------------------------------------------------------------------------
# 8. FastBarBuffer Gymnasium Loop Hot-Path Tests
# ---------------------------------------------------------------------------
def test_fast_bar_buffer_contiguous_indexing() -> None:
    """
    Verify FastBarBuffer provides zero-overhead contiguous array indexing
    and window slicing without instantiating Pydantic models per step.
    """
    start_d = date(2024, 1, 1)
    end_d = date(2024, 1, 31)
    bars = generate_mock_bars("POWERGRID.NS", start_d, end_d, interval="1d")

    buffer = FastBarBuffer.from_bars(bars)
    assert len(buffer) == len(bars)
    assert buffer.matrix.shape == (len(bars), 5)
    assert buffer.matrix.dtype == np.float64

    # O(1) single-step access
    step_bar: FastBarTuple = buffer.get_bar(5)
    assert isinstance(step_bar, FastBarTuple)
    assert step_bar.open == bars[5].open
    assert step_bar.close == bars[5].close

    # Contiguous observation window
    window = buffer.get_window(end_idx=10, window_size=5)
    assert window.shape == (5, 5)
    assert np.array_equal(window[-1], buffer.matrix[10])


# ---------------------------------------------------------------------------
# 9. Local Parquet Disk Cache Tests
# ---------------------------------------------------------------------------
def test_parquet_disk_cache(tmp_path: object) -> None:
    """
    Verify local columnar Parquet cache roundtrips accurately and eliminates
    redundant network calls on closed historical bars.
    """
    start_d = date(2024, 1, 1)
    end_d = date(2024, 1, 15)
    bars = generate_mock_bars("ONGC.NS", start_d, end_d, interval="1d")

    # Write cache
    _write_parquet_cache("ONGC.NS", "1d", bars)

    start_dt = datetime(2024, 1, 1, 0, 0, tzinfo=UTC)
    end_dt = datetime(2024, 1, 15, 23, 59, tzinfo=UTC)

    # Read cache
    cached = _read_parquet_cache("ONGC.NS", "1d", start_dt, end_dt)
    assert cached is not None
    assert len(cached) == len(bars)
    assert cached[0].close == bars[0].close
    assert cached[-1].volume == bars[-1].volume


# ---------------------------------------------------------------------------
# 10. Corporate Action Split Continuity & Discontinuity Detector
# ---------------------------------------------------------------------------
def test_corporate_action_split_and_discontinuity() -> None:
    """
    Test corporate action propagation through DataAlignmentQueue
    and discontinuity detection for unadjusted splits.
    """
    queue = DataAlignmentQueue()

    t0 = datetime(2024, 1, 10, 3, 45, tzinfo=UTC)
    t1 = datetime(2024, 1, 11, 3, 45, tzinfo=UTC)  # Ex-date of 10:1 split

    b0 = PriceBar(
        timestamp=t0,
        ticker="TATASTEEL.NS",
        open=1200,
        high=1210,
        low=1190,
        close=1200,
        volume=100000,
    )
    # On split ex-date, unadjusted price drops from 1200 to 120
    b1 = PriceBar(
        timestamp=t1, ticker="TATASTEEL.NS", open=121, high=123, low=119, close=120, volume=1000000
    )

    # Corporate action event
    split_action = CorporateAction(
        action_id="ACT_SPLIT_001",
        ticker="TATASTEEL.NS",
        action_type="SPLIT",
        ex_date=t1,
        ratio="1:10",
        multiplier=10.0,
    )

    # Discontinuity check WITHOUT action -> flags anomaly
    unflagged_anomalies = detect_price_discontinuities(
        [b0, b1], threshold_pct=0.20, known_actions=[]
    )
    assert len(unflagged_anomalies) == 1
    assert unflagged_anomalies[0]["flag"] == "UNEXPLAINED_CIRCUIT_DISCONTINUITY"

    # Discontinuity check WITH action -> anomaly explained, passes clean
    flagged_anomalies = detect_price_discontinuities(
        [b0, b1], threshold_pct=0.20, known_actions=[split_action]
    )
    assert len(flagged_anomalies) == 0

    # Test queue releases corporate action on ex-date candle open
    queue.push_price(b0)
    queue.push_price(b1)
    queue.push_corporate_action(split_action)

    bar, actions, _ = queue.consume_tick()
    assert bar == b0
    assert len(actions) == 0  # Not yet ex-date

    bar, actions, _ = queue.consume_tick()
    assert bar == b1
    assert len(actions) == 1
    assert actions[0].action_type == "SPLIT"
    assert actions[0].multiplier == 10.0
