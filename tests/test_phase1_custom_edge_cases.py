"""
Out-of-the-Box Adversarial & Stress Test Suite for Phase 1:
- Adversarial Candlestick Physics & Numerical Pitfalls (NaN, Inf, Circuit Flatlines)
- Temporal Chaos Monkey & Look-Ahead Bias Stress Invariants
- NSE Calendar Horizon, Microsecond Session Boundaries & Election Holidays
- FastBarBuffer Gymnasium Hot-Path Cold-Start & Out-of-Bounds Invariants
- Columnar Parquet Cache Deduplication, Overlapping Appends & Corrupt File Recovery
- Corporate Action & Price Discontinuity Auditor Boundary Conditions
"""

import random
import zoneinfo
from datetime import UTC, date, datetime, time, timedelta

import numpy as np
import pytest

from src.data.calendar import (
    IST,
    get_next_market_open,
    is_market_hours,
    is_trading_day,
    to_ist,
    to_utc,
)
from src.data.data_queue import DataAlignmentQueue
from src.data.fast_buffer import FastBarBuffer
from src.data.price_fetcher import (
    _get_cache_path,
    _read_parquet_cache,
    _write_parquet_cache,
    detect_price_discontinuities,
    generate_mock_bars,
    normalize_ticker,
    validate_candlestick,
)
from src.data.schemas import CorporateAction, NewsArticle, PriceBar


# ===========================================================================
# SCENARIO 1: Adversarial Candlestick Physics & Numerical Pitfalls
# ===========================================================================
class TestCandlestickPhysicsAdversarial:
    """Stress-test candlestick mathematics against non-finite and illegal values."""

    def test_non_finite_values_rejected(self) -> None:
        """Assert NaN and Inf are strictly rejected across all price fields and volume."""
        nan = float("nan")
        inf = float("inf")
        neg_inf = float("-inf")

        # Open non-finite
        assert not validate_candlestick(nan, 105.0, 95.0, 100.0, 1000.0)
        assert not validate_candlestick(inf, 105.0, 95.0, 100.0, 1000.0)
        assert not validate_candlestick(neg_inf, 105.0, 95.0, 100.0, 1000.0)

        # High non-finite
        assert not validate_candlestick(100.0, nan, 95.0, 100.0, 1000.0)
        assert not validate_candlestick(100.0, inf, 95.0, 100.0, 1000.0)

        # Low non-finite
        assert not validate_candlestick(100.0, 105.0, nan, 100.0, 1000.0)
        assert not validate_candlestick(100.0, 105.0, neg_inf, 100.0, 1000.0)

        # Close non-finite
        assert not validate_candlestick(100.0, 105.0, 95.0, nan, 1000.0)
        assert not validate_candlestick(100.0, 105.0, 95.0, inf, 1000.0)

        # Volume non-finite
        assert not validate_candlestick(100.0, 105.0, 95.0, 100.0, nan)
        assert not validate_candlestick(100.0, 105.0, 95.0, 100.0, inf)

    def test_circuit_locked_flatline_candles(self) -> None:
        """
        In Indian markets, stocks locked in upper/lower circuit limit open and close
        at the identical price with zero intraday spread (open == high == low == close).
        """
        # Upper/lower circuit locked day with trading volume
        assert validate_candlestick(250.0, 250.0, 250.0, 250.0, 50000.0)

        # Trading halt day where no trades occurred (volume == 0)
        assert validate_candlestick(250.0, 250.0, 250.0, 250.0, 0.0)

    def test_fractional_sub_penny_tick_precision(self) -> None:
        """Penny stocks trading at fractional rupee ticks (e.g. ₹0.05, ₹0.15)."""
        # Floating point precision representation
        assert validate_candlestick(0.30, 0.30000000000000004, 0.25, 0.28, 100000.0)
        assert validate_candlestick(0.05, 0.06, 0.05, 0.05, 500000.0)

    def test_inverted_crossed_geometry_matrix(self) -> None:
        """Systematic failure checks for corrupted geometries."""
        # High < Low
        assert not validate_candlestick(100.0, 90.0, 95.0, 92.0, 100.0)
        # High < Open
        assert not validate_candlestick(100.0, 99.0, 90.0, 95.0, 100.0)
        # High < Close
        assert not validate_candlestick(95.0, 98.0, 90.0, 99.0, 100.0)
        # Low > Open
        assert not validate_candlestick(100.0, 110.0, 101.0, 105.0, 100.0)
        # Low > Close
        assert not validate_candlestick(105.0, 110.0, 101.0, 100.0, 100.0)
        # Zero price
        assert not validate_candlestick(0.0, 10.0, 0.0, 5.0, 100.0)
        # Negative volume
        assert not validate_candlestick(100.0, 105.0, 95.0, 100.0, -1.0)


# ===========================================================================
# SCENARIO 2: Temporal Chaos Monkey & Look-Ahead Stress Testing
# ===========================================================================
class TestTemporalChaosMonkey:
    """Stress-test DataAlignmentQueue under extreme disorder and concurrency."""

    def test_chaos_monkey_large_scale_shuffled_influx(self) -> None:
        """
        Generate 1,000 mixed events across 30 days, shuffle them randomly,
        push into queue, and verify strict chronological recovery.
        """
        queue = DataAlignmentQueue()
        rng = random.Random(1337)
        base_ts = datetime(2024, 1, 1, 3, 45, tzinfo=UTC)

        events_pool: list[PriceBar | NewsArticle | CorporateAction] = []

        # 400 price bars (spaced 15 minutes apart)
        for i in range(400):
            ts = base_ts + timedelta(minutes=15 * i)
            events_pool.append(
                PriceBar(
                    timestamp=ts,
                    ticker="INFY.NS",
                    open=1500.0 + (i % 10),
                    high=1510.0 + (i % 10),
                    low=1495.0 + (i % 10),
                    close=1505.0 + (i % 10),
                    volume=50000.0,
                )
            )

        # 500 news articles (interleaved at pseudo-random minute offsets)
        for i in range(500):
            offset_mins = rng.randint(0, 15 * 400)
            ts = base_ts + timedelta(minutes=offset_mins)
            events_pool.append(
                NewsArticle(
                    article_id=f"CHAOS_NEWS_{i}",
                    ticker="INFY.NS",
                    title=f"Chatter item {i}",
                    published_at=ts,
                    source="Reddit",
                )
            )

        # 10 corporate actions
        for i in range(10):
            offset_mins = i * 600
            ts = base_ts + timedelta(minutes=offset_mins)
            events_pool.append(
                CorporateAction(
                    action_id=f"CHAOS_ACT_{i}",
                    ticker="INFY.NS",
                    action_type="DIVIDEND",
                    ex_date=ts,
                    multiplier=1.0,
                    dividend_amount=10.0,
                )
            )

        # Shuffle completely at random
        rng.shuffle(events_pool)

        # Ingest into queue in scrambled order
        for ev in events_pool:
            if isinstance(ev, PriceBar):
                queue.push_price(ev)
            elif isinstance(ev, NewsArticle):
                queue.push_news(ev)
            elif isinstance(ev, CorporateAction):
                queue.push_corporate_action(ev)

        # Consume all price bars
        consumed_bars: list[PriceBar] = []
        all_released_news: list[NewsArticle] = []
        all_released_actions: list[CorporateAction] = []

        while True:
            bar, actions, news = queue.consume_tick()
            if bar is None:
                break
            consumed_bars.append(bar)
            all_released_actions.extend(actions)
            all_released_news.extend(news)

            # Invariant 1: Monotonic clock progression
            if len(consumed_bars) > 1:
                assert bar.timestamp >= consumed_bars[-2].timestamp

            # Invariant 2: Released news was strictly published BEFORE bar timestamp
            for item in news:
                assert item.published_at < bar.timestamp, (
                    f"Look-ahead leakage: News {item.article_id} published at "
                    f"{item.published_at} released at bar {bar.timestamp}"
                )

            # Invariant 3: Released actions had ex-date on or before bar timestamp
            for act in actions:
                assert act.ex_date <= bar.timestamp

        assert len(consumed_bars) == 400
        # All actions must be released since the last bar is far in the future
        assert len(all_released_actions) == 10

    def test_triple_collision_exact_microsecond(self) -> None:
        """
        When Corporate Action, News Article, and Price Bar all share the exact
        same microsecond timestamp T:
        - Priority 0 (CorporateAction) applies on ex-date.
        - Priority 1 (NewsArticle) is HELD until next bar T+1 because latency
          makes same-moment execution impossible.
        - Priority 2 (PriceBar) advances clock.
        """
        queue = DataAlignmentQueue()
        t_col = datetime(2024, 1, 10, 3, 45, 0, 0, tzinfo=UTC)
        t_next = datetime(2024, 1, 10, 3, 50, 0, 0, tzinfo=UTC)

        b0 = PriceBar(
            timestamp=t_col, ticker="TCS.NS", open=3800, high=3810, low=3790, close=3805, volume=100
        )
        b1 = PriceBar(
            timestamp=t_next,
            ticker="TCS.NS",
            open=3805,
            high=3820,
            low=3800,
            close=3815,
            volume=120,
        )

        action = CorporateAction(
            action_id="SPLIT_COL",
            ticker="TCS.NS",
            action_type="SPLIT",
            ex_date=t_col,
            multiplier=2.0,
        )
        news = NewsArticle(
            article_id="NEWS_COL",
            ticker="TCS.NS",
            title="Instant news",
            published_at=t_col,
            source="ET",
        )

        queue.push_price(b0)
        queue.push_price(b1)
        queue.push_corporate_action(action)
        queue.push_news(news)

        # Consume tick at T
        bar0, actions0, news0 = queue.consume_tick()
        assert bar0 == b0
        assert len(actions0) == 1
        assert actions0[0].action_id == "SPLIT_COL"
        # News at T MUST NOT be released at bar T
        assert len(news0) == 0
        assert queue.pending_news_count == 1

        # Consume tick at T+1
        bar1, actions1, news1 = queue.consume_tick()
        assert bar1 == b1
        assert len(actions1) == 0
        assert len(news1) == 1
        assert news1[0].article_id == "NEWS_COL"

    def test_news_chatter_storm_high_velocity_burst(self) -> None:
        """
        Inject 500 news items within a single 5-minute candle window.
        Verify all 500 are safely held and released together at candle open.
        """
        queue = DataAlignmentQueue()
        t0 = datetime(2024, 1, 8, 3, 45, tzinfo=UTC)  # 09:15 IST
        t1 = datetime(2024, 1, 8, 3, 50, tzinfo=UTC)  # 09:20 IST

        b0 = PriceBar(
            timestamp=t0,
            ticker="RELIANCE.NS",
            open=2600,
            high=2610,
            low=2590,
            close=2605,
            volume=10,
        )
        b1 = PriceBar(
            timestamp=t1,
            ticker="RELIANCE.NS",
            open=2605,
            high=2615,
            low=2600,
            close=2610,
            volume=15,
        )

        queue.push_price(b0)
        queue.push_price(b1)

        # 500 articles arriving between 09:15:01 and 09:19:59 IST
        storm_ids = [f"STORM_{i:03d}" for i in range(500)]
        for i, aid in enumerate(storm_ids):
            pub_ts = t0 + timedelta(milliseconds=500 * (i + 1))
            queue.push_news(
                NewsArticle(
                    article_id=aid,
                    ticker="RELIANCE.NS",
                    title=f"Viral rumor #{i}",
                    published_at=pub_ts,
                    source="Twitter",
                )
            )

        # Consume Bar 0: none of the storm news should release yet
        _, _, news_b0 = queue.consume_tick()
        assert len(news_b0) == 0
        # The 500 news events are scheduled strictly after Bar 0, so they await in the priority heap
        assert queue.queue_size == 501

        # Consume Bar 1: ALL 500 must release in strict FIFO insertion order
        _, _, news_b1 = queue.consume_tick()
        assert len(news_b1) == 500
        released_ids = [n.article_id for n in news_b1]
        assert released_ids == storm_ids
        assert queue.pending_news_count == 0

    def test_multi_asset_synchronous_ticks(self) -> None:
        """
        In multi-asset simulations, multiple tickers have bars at the EXACT same timestamp.
        Ensure clock remains stable and news is released on the first tick without duplication.
        """
        queue = DataAlignmentQueue()
        t_same = datetime(2024, 1, 15, 3, 45, tzinfo=UTC)

        tickers = ["TCS.NS", "INFY.NS", "RELIANCE.NS", "HDFCBANK.NS", "POWERGRID.NS"]
        for t in tickers:
            queue.push_price(
                PriceBar(
                    timestamp=t_same,
                    ticker=t,
                    open=100.0,
                    high=105.0,
                    low=95.0,
                    close=102.0,
                    volume=1000.0,
                )
            )

        pre_news = NewsArticle(
            article_id="PRE_MKT_NEWS",
            ticker=None,
            title="Macro economy update",
            published_at=t_same - timedelta(minutes=5),
            source="Bloomberg",
        )
        queue.push_news(pre_news)

        consumed_tickers: list[str] = []
        total_released_news = 0

        for _ in range(len(tickers)):
            bar, _, news = queue.consume_tick()
            assert bar is not None
            assert bar.timestamp == t_same
            consumed_tickers.append(bar.ticker)
            total_released_news += len(news)

        assert len(consumed_tickers) == 5
        # The news item must be released exactly once across all 5 synchronous ticks
        assert total_released_news == 1
        assert queue.current_time == t_same

    def test_long_weekend_holiday_news_gap(self) -> None:
        """
        News published Friday evening after market close (Jan 19, 2024 at 20:00 IST).
        Jan 20-21 weekend + Jan 22 Ayodhya special holiday.
        Next open is Tuesday Jan 23 at 09:15 IST.
        Verify news is retained across the entire gap and released Tuesday morning.
        """
        fri_news_ts = datetime(2024, 1, 19, 14, 30, tzinfo=UTC)  # 20:00 IST Friday
        tue_open_ts = datetime(2024, 1, 23, 3, 45, tzinfo=UTC)  # 09:15 IST Tuesday

        mapped_open = get_next_market_open(to_ist(fri_news_ts))
        assert mapped_open == tue_open_ts

        queue = DataAlignmentQueue()
        queue.push_news(
            NewsArticle(
                article_id="WEEKEND_SCOOP",
                ticker="SBIN.NS",
                title="Weekend merger news",
                published_at=fri_news_ts,
                source="ET",
            )
        )
        queue.push_price(
            PriceBar(
                timestamp=tue_open_ts,
                ticker="SBIN.NS",
                open=600,
                high=615,
                low=595,
                close=610,
                volume=10000,
            )
        )

        bar, _, news = queue.consume_tick()
        assert bar is not None and bar.timestamp == tue_open_ts
        assert len(news) == 1
        assert news[0].article_id == "WEEKEND_SCOOP"

    def test_explicit_temporal_violation_guard(self) -> None:
        """Verify queue raises ValueError when a past bar is pushed after clock has advanced."""
        queue = DataAlignmentQueue()
        t1 = datetime(2024, 1, 10, 3, 50, tzinfo=UTC)
        t0 = datetime(2024, 1, 10, 3, 45, tzinfo=UTC)  # Past bar

        b1 = PriceBar(
            timestamp=t1, ticker="ONGC.NS", open=200, high=205, low=198, close=202, volume=100
        )
        queue.push_price(b1)

        # Advance clock to t1
        queue.consume_tick()
        assert queue.current_time == t1

        # Now push past bar t0 and attempt to consume
        b0 = PriceBar(
            timestamp=t0, ticker="ONGC.NS", open=198, high=202, low=196, close=200, volume=100
        )
        queue.push_price(b0)

        with pytest.raises(ValueError, match="Temporal violation"):
            queue.consume_tick()


# ===========================================================================
# SCENARIO 3: NSE Calendar Horizon & Boundary Edge Conditions
# ===========================================================================
class TestNSECalendarBoundaries:
    """Rigorous boundary and holiday auditing for the Indian market calendar."""

    def test_leap_year_feb_29(self) -> None:
        """Verify Feb 29, 2024 (Thursday) is correctly handled as an active trading day."""
        leap_day = date(2024, 2, 29)
        assert leap_day.weekday() == 3  # Thursday
        assert is_trading_day(leap_day)

    def test_election_ad_hoc_holidays(self) -> None:
        """Verify ad-hoc election holidays declared by Maharashtra/SEBI."""
        parliamentary_election = date(2024, 5, 20)  # Mumbai voting day
        assembly_election = date(2024, 11, 20)  # Assembly election day
        assert not is_trading_day(parliamentary_election)
        assert not is_trading_day(assembly_election)

    def test_microsecond_precision_session_boundaries(self) -> None:
        """Assert microsecond accuracy at 09:15 open and 15:30 close."""
        d = date(2024, 1, 24)  # Active Wednesday

        # 09:14:59.999999 IST -> Before open
        t_pre = datetime.combine(d, time(9, 14, 59, 999999), tzinfo=IST)
        assert not is_market_hours(t_pre)

        # 09:15:00.000000 IST -> Exactly at open
        t_open = datetime.combine(d, time(9, 15, 0, 0), tzinfo=IST)
        assert is_market_hours(t_open)

        # 15:15:00.000000 IST -> Intraday square-off
        t_sqoff = datetime.combine(d, time(15, 15, 0, 0), tzinfo=IST)
        assert is_market_hours(t_sqoff)

        # 15:30:00.000000 IST -> Exactly at close
        t_close = datetime.combine(d, time(15, 30, 0, 0), tzinfo=IST)
        assert is_market_hours(t_close)

        # 15:30:00.000001 IST -> After close
        t_post = datetime.combine(d, time(15, 30, 0, 1), tzinfo=IST)
        assert not is_market_hours(t_post)

    def test_cross_timezone_conversions(self) -> None:
        """Validate conversion round-trips from US/Eastern, Europe/London, and Asia/Tokyo."""
        ny_tz = zoneinfo.ZoneInfo("America/New_York")
        tokyo_tz = zoneinfo.ZoneInfo("Asia/Tokyo")

        ny_time = datetime(2024, 1, 10, 10, 0, tzinfo=ny_tz)
        tokyo_time = datetime(2024, 1, 10, 10, 0, tzinfo=tokyo_tz)

        # Round trip NY -> UTC -> IST -> UTC -> NY
        utc_from_ny = to_utc(ny_time)
        ist_from_ny = to_ist(utc_from_ny)
        assert utc_from_ny == to_utc(ist_from_ny)

        # Round trip Tokyo
        utc_tokyo = to_utc(tokyo_time)
        ist_tokyo = to_ist(utc_tokyo)
        assert utc_tokyo == to_utc(ist_tokyo)

    def test_calendar_coverage_extremes(self) -> None:
        """Verify years 2023 through 2026 are covered, and years outside raise ValueError."""
        # Lower horizon bound
        assert is_trading_day(date(2023, 1, 2))  # First trading day of 2023
        with pytest.raises(ValueError, match="outside verified holiday coverage"):
            is_trading_day(date(2022, 12, 31))

        # Upper horizon bound
        assert is_trading_day(date(2026, 12, 31))
        with pytest.raises(ValueError, match="outside verified holiday coverage"):
            is_trading_day(date(2027, 1, 1))


# ===========================================================================
# SCENARIO 4: FastBarBuffer Gymnasium Hot-Path Invariants
# ===========================================================================
class TestFastBarBufferHotPath:
    """Verify performance and safety bounds of FastBarBuffer."""

    def test_cold_start_window_edge_padding(self) -> None:
        """
        When window_size exceeds current step index (warm-up phase),
        FastBarBuffer must pad earlier rows with the earliest available bar (row 0).
        """
        bars = generate_mock_bars("POWERGRID.NS", date(2024, 1, 1), date(2024, 1, 15))
        buffer = FastBarBuffer.from_bars(bars)

        # Request 20 bars of context at step 0 (only 1 bar available)
        window = buffer.get_window(end_idx=0, window_size=20)
        assert window.shape == (20, 5)

        # Rows 0 to 18 should be identical replicas of row 0
        for r in range(19):
            assert np.array_equal(window[r], buffer.matrix[0])
        # Row 19 is the actual bar at index 0
        assert np.array_equal(window[19], buffer.matrix[0])

    def test_window_size_extremes(self) -> None:
        """Verify window_size=1, window_size=len, and illegal window_size <= 0."""
        bars = generate_mock_bars("ONGC.NS", date(2024, 1, 1), date(2024, 1, 10))
        buffer = FastBarBuffer.from_bars(bars)

        # window_size = 1
        w1 = buffer.get_window(end_idx=3, window_size=1)
        assert w1.shape == (1, 5)
        assert np.array_equal(w1[0], buffer.matrix[3])

        # window_size = len(buffer)
        w_all = buffer.get_window(end_idx=len(buffer) - 1, window_size=len(buffer))
        assert w_all.shape == (len(buffer), 5)
        assert np.array_equal(w_all, buffer.matrix)

        # window_size <= 0 must raise ValueError
        with pytest.raises(ValueError, match="window_size must be positive"):
            buffer.get_window(end_idx=2, window_size=0)
        with pytest.raises(ValueError, match="window_size must be positive"):
            buffer.get_window(end_idx=2, window_size=-5)

    def test_fast_bar_buffer_out_of_bounds(self) -> None:
        """Assert out-of-bounds indexing raises IndexError."""
        bars = generate_mock_bars("TCS.NS", date(2024, 1, 1), date(2024, 1, 10))
        buffer = FastBarBuffer.from_bars(bars)

        with pytest.raises(IndexError):
            buffer.get_bar(-1)
        with pytest.raises(IndexError):
            buffer.get_bar(len(buffer))
        with pytest.raises(IndexError):
            buffer.get_window(end_idx=-1, window_size=5)
        with pytest.raises(IndexError):
            buffer.get_window(end_idx=len(buffer), window_size=5)

    def test_c_contiguous_memory_and_empty_buffer(self) -> None:
        """Assert array memory is C-contiguous float64 and empty buffer is safe."""
        bars = generate_mock_bars("INFY.NS", date(2024, 1, 1), date(2024, 1, 10))
        buf = FastBarBuffer.from_bars(bars)
        assert buf.matrix.flags.c_contiguous
        assert buf.matrix.dtype == np.float64

        empty = FastBarBuffer.from_bars([])
        assert len(empty) == 0
        assert empty.matrix.shape == (0, 5)
        with pytest.raises(IndexError):
            empty.get_bar(0)


# ===========================================================================
# SCENARIO 5: Columnar Parquet Cache Stress & Corruption Recovery
# ===========================================================================
class TestParquetCacheStress:
    """Test disk cache deduplication, corruption resistance, and symbol sanitization."""

    def test_overlapping_incremental_append(self) -> None:
        """
        Simulate writing Jan 1-10, then Jan 5-15 (overlapping).
        Verify reading back Jan 1-15 contains zero duplicate timestamps.
        """
        ticker = "TEST_DEDUP.NS"
        bars_part1 = generate_mock_bars(ticker, date(2024, 1, 1), date(2024, 1, 10), seed=1)
        bars_part2 = generate_mock_bars(ticker, date(2024, 1, 5), date(2024, 1, 15), seed=2)

        _write_parquet_cache(ticker, "1d", bars_part1)
        _write_parquet_cache(ticker, "1d", bars_part2)

        start_dt = datetime(2024, 1, 1, 0, 0, tzinfo=UTC)
        end_dt = datetime(2024, 1, 15, 23, 59, tzinfo=UTC)

        cached = _read_parquet_cache(ticker, "1d", start_dt, end_dt)
        assert cached is not None

        # Verify all timestamps are unique and sorted
        ts_list = [b.timestamp for b in cached]
        assert len(ts_list) == len(set(ts_list))
        for i in range(1, len(ts_list)):
            assert ts_list[i] > ts_list[i - 1]

    def test_corrupted_file_recovery(self) -> None:
        """Verify that a corrupted or zero-byte cache file fails gracefully without crashing."""
        corrupt_ticker = "CORRUPT_STOCK.NS"
        path = _get_cache_path(corrupt_ticker, "1d")
        path.parent.mkdir(parents=True, exist_ok=True)
        # Write corrupted header
        path.write_bytes(b"CORRUPTED_PARQUET_HEADER_GARBAGE")

        start_dt = datetime(2024, 1, 1, tzinfo=UTC)
        end_dt = datetime(2024, 1, 10, tzinfo=UTC)

        result = _read_parquet_cache(corrupt_ticker, "1d", start_dt, end_dt)
        # Must catch exception and return None
        assert result is None

        # Cleanup
        if path.exists():
            path.unlink()

    def test_index_symbol_sanitization(self) -> None:
        """Verify tickers with caret ^ are sanitized properly in file path."""
        p_nsei = _get_cache_path("^NSEI", "1d")
        p_vix = _get_cache_path("^INDIAVIX", "1d")
        assert "^" not in p_nsei.name
        assert p_nsei.name == "INDEX_NSEI_1d.parquet"
        assert p_vix.name == "INDEX_INDIAVIX_1d.parquet"


# ===========================================================================
# SCENARIO 6: Corporate Action & Price Discontinuity Auditor
# ===========================================================================
class TestPriceDiscontinuityAuditor:
    """Stress-test statutory circuit thresholds and unsorted input tolerance."""

    def test_precise_circuit_limit_boundary_20pct(self) -> None:
        """Day-over-day price jump of exactly 20% vs 20.001%."""
        t0 = datetime(2024, 1, 10, 3, 45, tzinfo=UTC)
        t1 = datetime(2024, 1, 11, 3, 45, tzinfo=UTC)

        b0 = PriceBar(
            timestamp=t0, ticker="ITC.NS", open=100.0, high=105.0, low=98.0, close=100.0, volume=10
        )

        # 19.999% move -> should NOT be flagged (> 0.20 required)
        b_safe = PriceBar(
            timestamp=t1,
            ticker="ITC.NS",
            open=119.0,
            high=120.0,
            low=118.0,
            close=119.999,
            volume=10,
        )
        assert len(detect_price_discontinuities([b0, b_safe], threshold_pct=0.20)) == 0

        # 20.001% move -> MUST be flagged
        b_trigger = PriceBar(
            timestamp=t1,
            ticker="ITC.NS",
            open=120.0,
            high=121.0,
            low=119.0,
            close=120.001,
            volume=10,
        )
        anomalies = detect_price_discontinuities([b0, b_trigger], threshold_pct=0.20)
        assert len(anomalies) == 1
        assert anomalies[0]["flag"] == "UNEXPLAINED_CIRCUIT_DISCONTINUITY"

    def test_reverse_split_consolidation(self) -> None:
        """Reverse split (1-for-10 consolidation) causes 1000% jump in unadjusted price."""
        t0 = datetime(2024, 1, 10, 3, 45, tzinfo=UTC)
        t1 = datetime(2024, 1, 11, 3, 45, tzinfo=UTC)

        b0 = PriceBar(
            timestamp=t0, ticker="PENNY.NS", open=10.0, high=10.2, low=9.8, close=10.0, volume=1000
        )
        b1 = PriceBar(
            timestamp=t1,
            ticker="PENNY.NS",
            open=100.0,
            high=105.0,
            low=98.0,
            close=100.0,
            volume=100,
        )

        # Without corporate action
        anomalies = detect_price_discontinuities([b0, b1], threshold_pct=0.20)
        assert len(anomalies) == 1

        # With registered consolidation
        action = CorporateAction(
            action_id="ACT_REV_SPLIT",
            ticker="PENNY.NS",
            action_type="SPLIT",
            ex_date=t1,
            multiplier=0.1,
        )
        clean = detect_price_discontinuities([b0, b1], threshold_pct=0.20, known_actions=[action])
        assert len(clean) == 0

    def test_discontinuity_unsorted_and_degenerate_inputs(self) -> None:
        """Verify sorting robustness and handling of 0 or 1 bars."""
        # 0 bars
        assert detect_price_discontinuities([]) == []
        # 1 bar
        b0 = PriceBar(
            timestamp=datetime(2024, 1, 1, tzinfo=UTC),
            ticker="A.NS",
            open=100,
            high=105,
            low=95,
            close=100,
            volume=10,
        )
        assert detect_price_discontinuities([b0]) == []

        # Scrambled order input
        b1 = PriceBar(
            timestamp=datetime(2024, 1, 2, tzinfo=UTC),
            ticker="A.NS",
            open=102,
            high=106,
            low=98,
            close=103,
            volume=10,
        )
        b2 = PriceBar(
            timestamp=datetime(2024, 1, 3, tzinfo=UTC),
            ticker="A.NS",
            open=103,
            high=108,
            low=101,
            close=105,
            volume=10,
        )

        # Pass in reverse order [b2, b1, b0]
        anomalies = detect_price_discontinuities([b2, b1, b0], threshold_pct=0.20)
        assert len(anomalies) == 0


# ===========================================================================
# SCENARIO 7: Ticker Normalization Invariants
# ===========================================================================
class TestTickerNormalizationAdversarial:
    """Test whitespace, casing, index, and corporate rename edge cases."""

    def test_whitespace_and_casing(self) -> None:
        assert normalize_ticker("  sbin  ") == "SBIN.NS"
        assert normalize_ticker("infy.ns") == "INFY.NS"
        assert normalize_ticker("  TCS.BO  ") == "TCS.BO"

    def test_renames_and_indices(self) -> None:
        assert normalize_ticker("REC") == "RECLTD.NS"
        assert normalize_ticker("ZOMATO") == "ETERNAL.NS"
        assert normalize_ticker("TATAMOTORS") == "TMPV.NS"
        assert normalize_ticker("^NSEI") == "^NSEI"
        assert normalize_ticker("^INDIAVIX") == "^INDIAVIX"
