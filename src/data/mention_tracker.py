"""
Mention Velocity Tracking and 3-Sigma Rolling Z-Score Watchlist Trigger.

Monitors alternative financial news and social media chatter volume across a rolling
7-day window (168 hourly buckets) to detect abnormal institutional and retail sentiment surges.

Mathematical Formulation:
    mu_{7d} = mean(mentions_{t-168 : t})
    sigma_{7d} = std(mentions_{t-168 : t})
    z = (mentions_t - mu_{7d}) / sigma_{7d}  (if sigma > 0 else 0.0)

A dynamic watchlist trigger is issued when:
    z >= 3.0 AND mentions_t >= min_mentions (to avoid division-by-near-zero false alarms)
"""

from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta
from typing import Final

import numpy as np

from .calendar import to_utc
from .schemas import MentionVelocity, NewsArticle

DEFAULT_WINDOW_HOURS: Final[int] = 168  # 7 days * 24 hours
DEFAULT_THRESHOLD_Z: Final[float] = 3.0
DEFAULT_MIN_MENTIONS: Final[int] = 3


class MentionTracker:
    """
    Point-in-time mention velocity engine with sliding hourly deques.
    """

    def __init__(
        self,
        window_hours: int = DEFAULT_WINDOW_HOURS,
        threshold_z: float = DEFAULT_THRESHOLD_Z,
        min_mentions: int = DEFAULT_MIN_MENTIONS,
    ) -> None:
        self.window_hours = window_hours
        self.threshold_z = threshold_z
        self.min_mentions = min_mentions

        # Ticker -> deque of past hourly counts (length <= window_hours)
        self._history: dict[str, deque[int]] = defaultdict(lambda: deque(maxlen=self.window_hours))
        # Ticker -> current hour count accumulator
        self._current_counts: dict[str, int] = defaultdict(int)
        # Current bucket hour timestamp (floored to hour, UTC)
        self._current_hour: datetime | None = None

    @staticmethod
    def _floor_to_hour(dt: datetime) -> datetime:
        """Floor datetime to the start of its UTC hour."""
        utc_dt = to_utc(dt)
        return utc_dt.replace(minute=0, second=0, microsecond=0)

    def record_mention(self, ticker: str, timestamp: datetime) -> None:
        """
        Record a mention of an asset at a specific point in time.
        Automatically advances the hourly sliding window if hour boundary is crossed.
        """
        bar_hour = self._floor_to_hour(timestamp)

        if self._current_hour is None:
            self._current_hour = bar_hour
        elif bar_hour > self._current_hour:
            # Advance through missing elapsed hours
            self.advance_to(bar_hour)

        self._current_counts[ticker] += 1

    def record_article(self, article: NewsArticle) -> None:
        """Record all tickers mentioned in a NewsArticle."""
        tickers_to_record: set[str] = set()
        if article.ticker:
            tickers_to_record.add(article.ticker)
        for t in article.tickers_mentioned:
            tickers_to_record.add(t)

        for ticker in tickers_to_record:
            self.record_mention(ticker, article.published_at)

    def advance_to(self, new_time: datetime) -> list[MentionVelocity]:
        """
        Advance the tracking clock to new_time, flushing completed hourly buckets
        and computing rolling statistics for elapsed periods.
        """
        target_hour = self._floor_to_hour(new_time)
        if self._current_hour is None:
            self._current_hour = target_hour
            return []

        if target_hour <= self._current_hour:
            return []

        triggered_alerts: list[MentionVelocity] = []

        # Flush hour-by-hour until reaching target_hour
        while self._current_hour < target_hour:
            hour_stats = self.flush_bucket()
            for stat in hour_stats:
                if stat.triggered:
                    triggered_alerts.append(stat)
            self._current_hour += timedelta(hours=1)

        return triggered_alerts

    def get_velocity(self, ticker: str, as_of_time: datetime) -> MentionVelocity:
        """
        Compute point-in-time mention velocity and z-score for a specific asset
        without flushing the current hour's active counts.
        """
        count = self._current_counts.get(ticker, 0)
        history_list = list(self._history[ticker])

        if len(history_list) > 0:
            hist_arr = np.array(history_list, dtype=np.float64)
            mean = float(np.mean(hist_arr))
            std = float(np.std(hist_arr))
        else:
            mean = 0.0
            std = 0.0

        z_score = (count - mean) / std if std > 0.0 else 0.0
        triggered = (z_score >= self.threshold_z) and (count >= self.min_mentions)

        return MentionVelocity(
            ticker=ticker,
            timestamp=as_of_time,
            window_hours=self.window_hours,
            current_count=count,
            rolling_mean=round(mean, 4),
            rolling_std=round(std, 4),
            z_score=round(z_score, 4),
            triggered=triggered,
        )

    def flush_bucket(self) -> list[MentionVelocity]:
        """
        Finalize the current hourly bucket, append counts into rolling deque,
        compute z-scores, and clear active counters for the next hour.
        """
        bucket_time = self._current_hour or datetime.now(tz=UTC)
        results: list[MentionVelocity] = []
        all_tickers = set(self._current_counts.keys()) | set(self._history.keys())

        for ticker in all_tickers:
            count = self._current_counts.get(ticker, 0)
            hist = self._history[ticker]
            if len(hist) > 0:
                hist_arr = np.array(hist, dtype=np.float64)
                mean = float(np.mean(hist_arr))
                std = float(np.std(hist_arr))
            else:
                mean = 0.0
                std = 0.0

            z_score = (count - mean) / std if std > 0.0 else 0.0
            triggered = (z_score >= self.threshold_z) and (count >= self.min_mentions)

            # Record metrics
            stat = MentionVelocity(
                ticker=ticker,
                timestamp=bucket_time,
                window_hours=self.window_hours,
                current_count=count,
                rolling_mean=round(mean, 4),
                rolling_std=round(std, 4),
                z_score=round(z_score, 4),
                triggered=triggered,
            )
            results.append(stat)

            # Push current count into rolling historical memory
            self._history[ticker].append(count)

        self._current_counts.clear()
        return results

    def reset(self) -> None:
        """Reset all tracking history and counters."""
        self._history.clear()
        self._current_counts.clear()
        self._current_hour = None


def compute_historical_mention_velocities(
    articles: list[NewsArticle],
    window_hours: int = DEFAULT_WINDOW_HOURS,
    threshold_z: float = DEFAULT_THRESHOLD_Z,
    min_mentions: int = DEFAULT_MIN_MENTIONS,
) -> list[MentionVelocity]:
    """
    Process a chronological list of news articles and compute hourly mention velocities
    and 3-sigma watchlist triggers for offline backtest simulations.
    """
    if not articles:
        return []

    sorted_articles = sorted(articles, key=lambda a: a.published_at)
    tracker = MentionTracker(
        window_hours=window_hours, threshold_z=threshold_z, min_mentions=min_mentions
    )

    all_velocities: list[MentionVelocity] = []

    for art in sorted_articles:
        alerts = tracker.advance_to(art.published_at)
        all_velocities.extend(alerts)
        tracker.record_article(art)

    # Final bucket flush
    final_stats = tracker.flush_bucket()
    all_velocities.extend(final_stats)

    return all_velocities
