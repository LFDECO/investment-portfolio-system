"""
Asynchronous & Synchronous Priority Event Queue for Point-in-Time Data Alignment.

Guarantees non-decreasing chronological event ordering and enforces the core
Look-Ahead Bias Prevention Rule:
News events timestamped at t_news are buffered until the next price bar
with timestamp > t_news arrives, preventing future information leakage into past candles.
"""

import heapq
import itertools
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from .schemas import CorporateAction, NewsArticle, PriceBar


@dataclass(order=True)
class TimestampedEvent:
    """
    Priority queue event ordered deterministically by (timestamp, priority, sequence_id).
    Priority:
        0: Corporate actions (splits, bonuses on ex-date, evaluated before trading begins)
        1: News events & social chatter (buffered into pending pool before candle open)
        2: Price bars (market clock advancement and pending event release evaluation)
    Sequence ID:
        Monotonically increasing integer assigned at insertion time.
        Guarantees strict FIFO stability when multiple events share identical timestamps.
    """

    timestamp: datetime
    priority: int = field(compare=True)
    sequence_id: int = field(compare=True)
    event_type: Literal["price", "corporate_action", "news"] = field(compare=False)
    payload: Any = field(compare=False)


class DataAlignmentQueue:
    """
    Point-in-Time Event Bus and Alignment Queue.

    Guarantees:
    1. Events are sorted chronologically by timestamp (t_0 <= t_1 <= t_2).
    2. Strict FIFO stability via monotonic sequence_id tie-breaking.
    3. Simulation clock strictly advances monotonically upon consuming price bars.
    4. News events timestamped at t_news are buffered and only released alongside
       the first subsequent price bar whose open timestamp > t_news.
    5. Zero look-ahead bias: the agent cannot see or trade on news before its arrival time.
    """

    def __init__(self) -> None:
        self._heap: list[TimestampedEvent] = []
        self._pending_news: list[NewsArticle] = []
        self._pending_actions: list[CorporateAction] = []
        self._latest_actions: list[CorporateAction] = []
        self._sim_clock: datetime | None = None
        self._seq_counter = itertools.count()
        self._total_price_bars: int = 0
        self._total_news_articles: int = 0
        self._total_corporate_actions: int = 0

    def _next_seq(self) -> int:
        return next(self._seq_counter)

    def push_price(self, bar: PriceBar) -> None:
        """Push a price candle into the priority queue."""
        event = TimestampedEvent(
            timestamp=bar.timestamp,
            priority=2,
            sequence_id=self._next_seq(),
            event_type="price",
            payload=bar,
        )
        heapq.heappush(self._heap, event)
        self._total_price_bars += 1

    def push_corporate_action(self, action: CorporateAction) -> None:
        """Push a corporate action (split, bonus, dividend) on its ex-date."""
        event = TimestampedEvent(
            timestamp=action.ex_date,
            priority=0,
            sequence_id=self._next_seq(),
            event_type="corporate_action",
            payload=action,
        )
        heapq.heappush(self._heap, event)
        self._total_corporate_actions += 1

    def push_news(self, article: NewsArticle) -> None:
        """Push a news article or social chatter event into the priority queue."""
        event = TimestampedEvent(
            timestamp=article.published_at,
            priority=1,
            sequence_id=self._next_seq(),
            event_type="news",
            payload=article,
        )
        heapq.heappush(self._heap, event)
        self._total_news_articles += 1

    def push_batch(
        self,
        prices: Iterable[PriceBar] = (),
        actions: Iterable[CorporateAction] = (),
        news: Iterable[NewsArticle] = (),
    ) -> None:
        """Efficiently push multiple price bars, corporate actions, and news events."""
        for bar in prices:
            self.push_price(bar)
        for act in actions:
            self.push_corporate_action(act)
        for item in news:
            self.push_news(item)

    def consume_tick(
        self,
    ) -> tuple[PriceBar | None, list[CorporateAction], list[NewsArticle]]:
        """
        Advance the simulation clock to the next price bar.

        Returns:
            (price_bar, released_actions, released_news)
        """
        released_news: list[NewsArticle] = []
        released_actions: list[CorporateAction] = []

        while self._heap:
            event = heapq.heappop(self._heap)

            if event.event_type == "news":
                # Buffer news until a subsequent price bar arrives
                article: NewsArticle = event.payload
                self._pending_news.append(article)

            elif event.event_type == "corporate_action":
                # Buffer corporate action until ex-date candle arrives
                action: CorporateAction = event.payload
                self._pending_actions.append(action)

            elif event.event_type == "price":
                bar: PriceBar = event.payload

                # Verify monotonic clock invariant
                if self._sim_clock is not None and bar.timestamp < self._sim_clock:
                    raise ValueError(
                        f"Temporal violation: New bar at {bar.timestamp} "
                        f"is earlier than current clock {self._sim_clock}"
                    )

                # Release corporate actions effective on or before this candle
                ready_actions: list[CorporateAction] = []
                remaining_actions: list[CorporateAction] = []
                for act in self._pending_actions:
                    if act.ex_date <= bar.timestamp:
                        ready_actions.append(act)
                    else:
                        remaining_actions.append(act)
                self._pending_actions = remaining_actions
                self._latest_actions = ready_actions
                released_actions = ready_actions

                # Release news strictly published BEFORE this bar's timestamp.
                # Explicit Invariant:
                # If item.published_at < bar.timestamp:
                #     News was published strictly before candle open. Agent can execute at bar.open.
                # If item.published_at >= bar.timestamp:
                #     News arrived at the exact instant of candle open or later.
                #     Due to network propagation, parsing, and order routing latency,
                #     execution at this bar's open is impossible.
                #     The event is retained in pending buffer and released at bar[i+1].
                ready_news: list[NewsArticle] = []
                remaining_news: list[NewsArticle] = []

                for item in self._pending_news:
                    if item.published_at < bar.timestamp:
                        ready_news.append(item)
                    else:
                        remaining_news.append(item)

                self._pending_news = remaining_news
                self._sim_clock = bar.timestamp
                return bar, released_actions, ready_news

        # Queue exhausted of price bars
        return None, released_actions, released_news

    def consume_next_bar(self) -> tuple[PriceBar | None, list[NewsArticle]]:
        """
        Convenience wrapper returning (PriceBar, list[NewsArticle]).
        Preserves backward compatibility for standard price/news consumers.
        """
        bar, _, released_news = self.consume_tick()
        return bar, released_news

    @property
    def latest_corporate_actions(self) -> list[CorporateAction]:
        """Corporate actions released at the current price bar tick."""
        return self._latest_actions

    @property
    def current_time(self) -> datetime | None:
        """Current simulation clock time (timestamp of latest consumed price bar)."""
        return self._sim_clock

    @property
    def pending_news_count(self) -> int:
        """Count of news articles currently buffered awaiting next price bar."""
        return len(self._pending_news)

    @property
    def pending_actions_count(self) -> int:
        """Count of corporate actions currently buffered awaiting ex-date."""
        return len(self._pending_actions)

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
        self._pending_actions.clear()
        self._latest_actions.clear()
        self._sim_clock = None
        self._seq_counter = itertools.count()
        self._total_price_bars = 0
        self._total_news_articles = 0
        self._total_corporate_actions = 0
