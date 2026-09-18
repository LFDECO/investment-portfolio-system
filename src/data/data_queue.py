"""
Asynchronous & Synchronous Priority Event Queue for Point-in-Time Data Alignment.

Guarantees non-decreasing chronological event ordering and enforces the core
Look-Ahead Bias Prevention Rule:
News events timestamped at t_news are buffered until the next price bar
with timestamp > t_news arrives, preventing future information leakage into past candles.
"""

import heapq
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from .schemas import NewsArticle, PriceBar


@dataclass(order=True)
class TimestampedEvent:
    """
    Priority queue event ordered deterministically by timestamp, then priority.
    Priority: 0 for price bars, 1 for news events.
    """

    timestamp: datetime
    priority: int = field(compare=True)
    event_type: Literal["price", "news"] = field(compare=False)
    payload: Any = field(compare=False)


class DataAlignmentQueue:
    """
    Point-in-Time Event Bus and Alignment Queue.

    Guarantees:
    1. Events are sorted chronologically by timestamp (t_0 <= t_1 <= t_2).
    2. Simulation clock strictly advances monotonically upon consuming price bars.
    3. News events timestamped at t_news are buffered and only released alongside
       the first subsequent price bar whose open timestamp > t_news.
    4. Zero look-ahead bias: the agent cannot see or trade on news before its arrival time.
    """

    def __init__(self) -> None:
        self._heap: list[TimestampedEvent] = []
        self._pending_news: list[NewsArticle] = []
        self._sim_clock: datetime | None = None
        self._total_price_bars: int = 0
        self._total_news_articles: int = 0

    def push_price(self, bar: PriceBar) -> None:
        """Push a price candle into the priority queue."""
        event = TimestampedEvent(
            timestamp=bar.timestamp,
            priority=0,
            event_type="price",
            payload=bar,
        )
        heapq.heappush(self._heap, event)
        self._total_price_bars += 1

    def push_news(self, article: NewsArticle) -> None:
        """Push a news article or social chatter event into the priority queue."""
        event = TimestampedEvent(
            timestamp=article.published_at,
            priority=1,
            event_type="news",
            payload=article,
        )
        heapq.heappush(self._heap, event)
        self._total_news_articles += 1

    def push_batch(
        self,
        prices: Iterable[PriceBar] = (),
        news: Iterable[NewsArticle] = (),
    ) -> None:
        """Efficiently push multiple price bars and news events into the queue."""
        for bar in prices:
            self.push_price(bar)
        for item in news:
            self.push_news(item)

    def consume_next_bar(self) -> tuple[PriceBar | None, list[NewsArticle]]:
        """
        Advance the simulation clock to the next price bar.

        Returns:
            (price_bar, released_news):
            - price_bar: The next chronological PriceBar.
            - released_news: All news articles that arrived strictly before
              this price bar's timestamp. News arriving at or after this bar's
              timestamp remains buffered in the queue for future bars.
        """
        released_news: list[NewsArticle] = []

        while self._heap:
            event = heapq.heappop(self._heap)

            if event.event_type == "news":
                # News event: buffer it until a subsequent price bar arrives
                article: NewsArticle = event.payload
                self._pending_news.append(article)

            elif event.event_type == "price":
                bar: PriceBar = event.payload

                # Check previous clock invariant
                if self._sim_clock is not None:
                    assert bar.timestamp >= self._sim_clock, (
                        f"Temporal violation: New bar at {bar.timestamp} "
                        f"is earlier than current clock {self._sim_clock}"
                    )

                # Release only news that arrived STRICTLY BEFORE this bar's timestamp
                ready_news: list[NewsArticle] = []
                remaining_news: list[NewsArticle] = []

                for item in self._pending_news:
                    if item.published_at < bar.timestamp:
                        ready_news.append(item)
                    else:
                        remaining_news.append(item)

                self._pending_news = remaining_news
                self._sim_clock = bar.timestamp
                return bar, ready_news

        # If price bars are exhausted, any remaining news cannot be traded on
        return None, released_news

    @property
    def current_time(self) -> datetime | None:
        """Current simulation clock time (timestamp of latest consumed price bar)."""
        return self._sim_clock

    @property
    def pending_news_count(self) -> int:
        """Count of news articles currently buffered awaiting next price bar."""
        return len(self._pending_news)

    @property
    def queue_size(self) -> int:
        """Total unpopped events remaining in the heap."""
        return len(self._heap)

    def is_empty(self) -> bool:
        """Check if all events in the heap have been consumed."""
        return len(self._heap) == 0

    def peek_timestamp(self) -> datetime | None:
        """Inspect the timestamp of the earliest unpopped event without popping."""
        if not self._heap:
            return None
        return self._heap[0].timestamp

    def reset(self) -> None:
        """Clear all events and reset the simulation clock."""
        self._heap.clear()
        self._pending_news.clear()
        self._sim_clock = None
        self._total_price_bars = 0
        self._total_news_articles = 0
