"""
Automated Test Suite for Phase 2:
- High-precision entity resolution and ticker mapping
- RSS feed and public Reddit parser normalization
- SHA-256 fingerprint deduplication
- Mention velocity rolling z-score and 3-sigma watchlist trigger mechanics
- Strict point-in-time temporal alignment through DataAlignmentQueue
"""

from datetime import UTC, date, datetime, timedelta

import numpy as np

from src.data.data_queue import DataAlignmentQueue
from src.data.entity_mapper import (
    EntityMapper,
    extract_tickers,
    resolve_ticker,
)
from src.data.mention_tracker import (
    MentionTracker,
    compute_historical_mention_velocities,
)
from src.data.news_scraper import (
    clean_html_text,
    compute_article_fingerprint,
    generate_mock_news_stream,
)
from src.data.schemas import NewsArticle, PriceBar


# ===========================================================================
# 1. Entity Resolution & Ticker Mapping Tests
# ===========================================================================
class TestEntityResolution:
    """Test precision of company nickname, alias, and acronym extraction."""

    def test_multi_word_longest_match_precedence(self) -> None:
        """Verify multi-word company names take precedence over single-word tokens."""
        text1 = "Tata Motors Commercial and Tata Steel led the rally today"
        tickers1 = extract_tickers(text1)
        assert tickers1 == ["TMPV.NS", "TATASTEEL.NS"]

        text2 = "State Bank of India reported quarterly profits while HDFC Bank gained"
        tickers2 = extract_tickers(text2)
        assert tickers2 == ["SBIN.NS", "HDFCBANK.NS"]

        text3 = "Adani Ports and Special Economic Zone outperformed Adani Enterprises"
        tickers3 = extract_tickers(text3)
        assert tickers3 == ["ADANIPORTS.NS", "ADANIENT.NS"]

    def test_corporate_renames_and_aliases(self) -> None:
        """Verify historical corporate renames map to canonical active tickers."""
        # Zomato -> ETERNAL
        assert resolve_ticker("Zomato") == "ETERNAL.NS"
        assert resolve_ticker("Eternal") == "ETERNAL.NS"
        assert extract_tickers("Zomato reports stellar quick commerce growth") == ["ETERNAL.NS"]

        # REC -> RECLTD
        assert resolve_ticker("REC") == "RECLTD.NS"
        assert resolve_ticker("REC Limited") == "RECLTD.NS"
        assert extract_tickers("REC approved Rs 5000 cr loan package") == ["RECLTD.NS"]

        # Tata Motors -> TMPV
        assert resolve_ticker("TATAMOTORS") == "TMPV.NS"
        assert resolve_ticker("Tata Motors") == "TMPV.NS"

    def test_dollar_prefixed_tickers(self) -> None:
        """Verify social media $-prefixed tickers (e.g. $INFY, $TCS, $RELIANCE)."""
        text = "Strong breakout in $INFY and $TCS; watching $RELIANCE"
        tickers = extract_tickers(text)
        assert tickers == ["INFY.NS", "TCS.NS", "RELIANCE.NS"]

    def test_false_positive_suppression(self) -> None:
        """Verify common English words do not accidentally trigger ticker matches."""
        # 'it', 'on', 'can', 'for', 'now', 'be' are generic English words
        generic_sentence = "It is on the table and can be done for now without any delay"
        assert extract_tickers(generic_sentence) == []

        # But uppercase ITC or ONGC should match
        assert extract_tickers("ITC declared a dividend") == ["ITC.NS"]
        assert extract_tickers("ONGC declared offshore drilling results") == ["ONGC.NS"]

    def test_article_title_priority_mapping(self) -> None:
        """Verify title entity takes precedence as primary ticker over body mentions."""
        mapper = EntityMapper()
        title = "Power Grid wins massive transmission project"
        body = "State Bank of India and ICICI Bank financed the initiative."

        primary, mentioned = mapper.map_article(title, body)
        assert primary == "POWERGRID.NS"
        assert mentioned == ["POWERGRID.NS", "SBIN.NS", "ICICIBANK.NS"]


# ===========================================================================
# 2. Text Normalization & Scraper Tests
# ===========================================================================
class TestScraperNormalization:
    """Test text cleaning, deduplication, and public feed parsing."""

    def test_clean_html_text(self) -> None:
        raw = "<p>Sensex surges &amp; Nifty crosses 25,000 marks.<br> Read more &gt;&gt;</p>"
        clean = clean_html_text(raw)
        assert clean == "Sensex surges & Nifty crosses 25,000 marks. Read more >>"

        assert clean_html_text("") == ""
        assert clean_html_text("   plain   text   ") == "plain text"

    def test_compute_article_fingerprint(self) -> None:
        fp1 = compute_article_fingerprint("moneycontrol", "https://mc.com/news1")
        fp2 = compute_article_fingerprint("MONEYCONTROL", "https://mc.com/news1")
        fp3 = compute_article_fingerprint("economic_times", "https://mc.com/news1")

        # Case-insensitive source deduplication
        assert fp1 == fp2
        # Different sources produce different fingerprints
        assert fp1 != fp3
        assert len(fp1) == 16

    def test_mock_news_stream_generator(self) -> None:
        start_d = date(2024, 1, 1)
        end_d = date(2024, 1, 10)
        tickers = ["POWERGRID.NS", "ONGC.NS"]

        stream = generate_mock_news_stream(tickers, start_d, end_d, seed=123, density_per_day=3)
        assert len(stream) > 0

        # Assert chronological order
        for i in range(1, len(stream)):
            assert stream[i].published_at >= stream[i - 1].published_at

        for art in stream:
            assert art.ticker in tickers
            assert art.published_at.tzinfo is not None
            assert len(art.tickers_mentioned) > 0


# ===========================================================================
# 3. Mention Velocity & 3-Sigma Watchlist Trigger Tests
# ===========================================================================
class TestMentionVelocityTracker:
    """Test rolling z-score mathematics and alert triggering."""

    def test_rolling_z_score_mathematics(self) -> None:
        """
        Verify exact rolling mean, std, and z-score calculation against numpy.
        """
        tracker = MentionTracker(window_hours=10, threshold_z=3.0, min_mentions=3)
        base_time = datetime(2024, 1, 1, 10, 0, tzinfo=UTC)

        # Populate 10 hours with known counts: [1, 2, 1, 2, 1, 2, 1, 2, 1, 2]
        history_counts = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2]
        for hour_idx, cnt in enumerate(history_counts):
            ts = base_time + timedelta(hours=hour_idx)
            for _ in range(cnt):
                tracker.record_mention("POWERGRID.NS", ts)

        # Advance to hour 10 (flushing completed hour 9)
        surge_time = base_time + timedelta(hours=10)
        tracker.advance_to(surge_time)

        # At hour 10: inject a surge of 10 mentions
        for _ in range(10):
            tracker.record_mention("POWERGRID.NS", surge_time)

        stat = tracker.get_velocity("POWERGRID.NS", surge_time)

        # Expected stats:
        # history array = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2]
        expected_mean = float(np.mean(history_counts))  # 1.5
        expected_std = float(np.std(history_counts))  # 0.5
        expected_z = (10 - expected_mean) / expected_std  # (10 - 1.5) / 0.5 = 17.0

        assert np.isclose(stat.rolling_mean, expected_mean, atol=1e-3)
        assert np.isclose(stat.rolling_std, expected_std, atol=1e-3)
        assert np.isclose(stat.z_score, expected_z, atol=1e-3)
        assert stat.triggered is True
        assert stat.current_count == 10

    def test_min_mentions_threshold_prevents_false_alarms(self) -> None:
        """
        If history has 0 mentions everywhere (std=0), a single mention count=1
        must NOT trigger an alert even if z-score mathematically blows up.
        """
        tracker = MentionTracker(window_hours=24, threshold_z=3.0, min_mentions=3)
        t = datetime(2024, 1, 1, 12, 0, tzinfo=UTC)

        # Single mention in empty baseline
        tracker.record_mention("ILLIQUID.NS", t)
        stat = tracker.get_velocity("ILLIQUID.NS", t)

        assert stat.current_count == 1
        # Trigger requires current_count >= min_mentions (3)
        assert stat.triggered is False

    def test_advance_to_sliding_window_progression(self) -> None:
        """Verify advance_to flushes elapsed hours and detects triggers automatically."""
        tracker = MentionTracker(window_hours=5, threshold_z=2.5, min_mentions=3)
        t0 = datetime(2024, 1, 1, 0, 0, tzinfo=UTC)

        # Baseline: 1 mention per hour for 5 hours
        for h in range(5):
            t = t0 + timedelta(hours=h)
            tracker.record_mention("RELIANCE.NS", t)

        # Surge at hour 6: 12 mentions
        t6 = t0 + timedelta(hours=6)
        for _ in range(12):
            tracker.record_mention("RELIANCE.NS", t6)

        # Advance clock to hour 7
        t7 = t0 + timedelta(hours=7)
        alerts = tracker.advance_to(t7)

        assert len(alerts) >= 1
        surge_alert = [a for a in alerts if a.ticker == "RELIANCE.NS" and a.current_count == 12]
        assert len(surge_alert) == 1
        assert surge_alert[0].triggered is True


# ===========================================================================
# 4. Point-in-Time Queue Integration Tests
# ===========================================================================
class TestPointInTimeNewsAlignment:
    """Test strict alignment of alternative news data in DataAlignmentQueue."""

    def test_news_aligned_to_subsequent_candle_open(self) -> None:
        """
        News arriving during regular trading hours MUST NOT influence the open
        of the ongoing bar; it can only execute at the subsequent candle open.
        """
        queue = DataAlignmentQueue()

        # Candle 1: 09:15 to 09:20 IST (03:45 UTC)
        # Candle 2: 09:20 to 09:25 IST (03:50 UTC)
        t_bar0 = datetime(2024, 1, 10, 3, 45, tzinfo=UTC)
        t_bar1 = datetime(2024, 1, 10, 3, 50, tzinfo=UTC)

        b0 = PriceBar(
            timestamp=t_bar0,
            ticker="TCS.NS",
            open=3800,
            high=3810,
            low=3795,
            close=3805,
            volume=100,
        )
        b1 = PriceBar(
            timestamp=t_bar1,
            ticker="TCS.NS",
            open=3805,
            high=3825,
            low=3800,
            close=3820,
            volume=150,
        )

        # News published at 09:16 IST (between bar 0 and bar 1)
        t_news = datetime(2024, 1, 10, 3, 46, tzinfo=UTC)
        news = NewsArticle(
            article_id="INTRADAY_001",
            ticker="TCS.NS",
            title="TCS signs $1B cloud partnership",
            published_at=t_news,
            source="Moneycontrol",
        )

        queue.push_price(b0)
        queue.push_price(b1)
        queue.push_news(news)

        # Bar 0 is consumed: news must NOT be released
        bar0, released0 = queue.consume_next_bar()
        assert bar0 == b0
        assert len(released0) == 0

        # Bar 1 is consumed: news is NOW released at Bar 1 open
        bar1, released1 = queue.consume_next_bar()
        assert bar1 == b1
        assert len(released1) == 1
        assert released1[0].article_id == "INTRADAY_001"

    def test_batch_historical_mention_velocities(self) -> None:
        """Test offline batch calculation of mention velocities for backtests."""
        base_time = datetime(2024, 1, 1, 10, 0, tzinfo=UTC)
        articles = [
            NewsArticle(
                article_id=f"ART_{i}",
                ticker="SBIN.NS",
                title=f"Article {i}",
                published_at=base_time + timedelta(minutes=10 * i),
                source="ET",
            )
            for i in range(20)
        ]

        velocities = compute_historical_mention_velocities(articles, window_hours=24)
        assert len(velocities) > 0
        sbin_stats = [v for v in velocities if v.ticker == "SBIN.NS"]
        assert len(sbin_stats) > 0
