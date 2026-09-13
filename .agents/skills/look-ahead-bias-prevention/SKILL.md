---
name: look-ahead-bias-prevention
description: >-
  Enforce strict point-in-time data integrity to prevent look-ahead bias
  in the trading simulation. Use this skill when designing data pipelines
  that must guarantee features at timestamp t only reference data ≤ t,
  aligning news events to subsequent candle opens, auditing rolling-window
  computations for future data leakage, handling survivorship bias in the
  Indian ticker universe, or writing automated tests and assertions to
  detect look-ahead bias in features, labels, or strategy logic.
---

# Look-Ahead Bias Prevention

This skill covers the critical constraint of point-in-time data integrity,
which is the single most important correctness requirement in any backtesting
system. **A backtest with look-ahead bias produces meaningless results.**

---

## 1. What is Look-Ahead Bias?

Look-ahead bias occurs when information from the future (relative to the
simulation's current timestamp) leaks into the decision-making process.

### Common Sources in Trading Systems

| Bias Type | Example | Impact |
|---|---|---|
| **Feature leakage** | Using tomorrow's close to compute today's RSI | Inflated indicators |
| **News peeking** | Scoring earnings news at the candle before announcement | Impossible trades |
| **Survivorship bias** | Only backtesting stocks that exist today | Omits delistings |
| **Label leakage** | Computing rolling window that includes future data | Overfitting |
| **Fill assumption** | Assuming fills at close when order was placed mid-bar | Unrealistic returns |
| **Data snooping** | Optimizing params on the same data used for testing | Overfitting |

---

## 2. Architectural Rules — The 6 Commandments

### Rule 1: Feature Timestamp Invariant
```
∀ feature f computed at time t:
  f(t) MUST be a function of data D where ∀ d ∈ D: timestamp(d) ≤ t
```

In code: every function that computes features must accept a
`max_timestamp` parameter and filter data accordingly.

### Rule 2: News → Next Candle Open
```
If news_event.published_at = t_news,
then the sentiment feature derived from this news
is only available at the NEXT candle with open_timestamp > t_news
```

**Never** use news published at 2:30 PM to inform a trade at 2:30 PM.
It can only inform the 2:35 PM candle (for 5-min bars) or the next day's
open (for daily bars).

### Rule 3: Rolling Windows Use `min_periods`
```python
# CORRECT — NaN for first window_size-1 rows
series.rolling(window=20, min_periods=20).mean()

# WRONG — fills from row 0 with partial windows
series.rolling(window=20, min_periods=1).mean()
```

### Rule 4: No Future-Filling
```python
# WRONG — forward fills with future data
df.fillna(method='bfill')
df.interpolate()

# CORRECT — only forward-fill with past data
df.fillna(method='ffill')
# Or better: leave NaN and handle in model
```

### Rule 5: Survivorship-Free Universe
```python
# WRONG — use today's NIFTY 50 constituents to backtest 2015-2020
tickers = get_current_nifty50()

# CORRECT — use point-in-time constituent lists
tickers = get_nifty50_constituents_as_of(date="2015-01-01")
```

For Indian markets: NSE publishes historical index constituent changes.
Track additions, deletions, and delistings.

### Rule 6: Execution at Realistic Prices
```python
# WRONG — assume fill at the current bar's close
fill_price = bar.close

# CORRECT — fill at next bar's open + slippage
fill_price = next_bar.open + calculate_slippage(order_size, volume)
```

---

## 3. Event Queue Design Pattern

The canonical pattern for preventing news-to-price look-ahead:

```python
from datetime import datetime
from dataclasses import dataclass, field
from typing import Any
import heapq

@dataclass(order=True)
class TimeEvent:
    timestamp: datetime
    priority: int = field(compare=True)  # 0=price, 1=news (price first)
    event_type: str = field(compare=False)
    data: Any = field(compare=False)

class PointInTimeEventBus:
    """
    Event bus that guarantees temporal ordering and prevents look-ahead.

    Rules:
    1. Events are consumed in strict chronological order
    2. News events at time t are not visible until a price event at time > t
    3. The simulation clock only advances when a price event is consumed
    """

    def __init__(self):
        self._heap: list[TimeEvent] = []
        self._sim_clock: datetime | None = None
        self._pending_news: list[dict] = []  # News waiting for next price bar

    def push(self, event: TimeEvent) -> None:
        heapq.heappush(self._heap, event)

    def consume_next_bar(self) -> tuple[dict | None, list[dict]]:
        """
        Advance to the next price bar and return it along with any
        news events that occurred before this bar.

        Returns:
            (price_bar, [news_events_since_last_bar])

        The returned news events are those with timestamps strictly
        between the previous bar and this bar. They are now "available"
        to the strategy.
        """
        released_news = []

        while self._heap:
            event = heapq.heappop(self._heap)

            if event.event_type == "news":
                # Buffer news — it becomes available at the NEXT price bar
                self._pending_news.append(event.data)

            elif event.event_type == "price":
                # Release all buffered news (they occurred before this bar)
                released_news = list(self._pending_news)
                self._pending_news.clear()
                self._sim_clock = event.timestamp
                return event.data, released_news

        return None, released_news

    @property
    def current_time(self) -> datetime | None:
        return self._sim_clock
```

---

## 4. Timestamp Audit Trail

Every feature computation should carry an audit trail proving no future data
was used.

```python
from pydantic import BaseModel, Field
from datetime import datetime

class AuditedFeature(BaseModel):
    """A feature value with provenance metadata."""
    name: str
    value: float
    computed_at: datetime = Field(..., description="Simulation clock when computed")
    data_cutoff: datetime = Field(..., description="Latest data point used")
    lookback_bars: int = Field(..., description="Number of historical bars used")

    def validate_no_lookahead(self, sim_clock: datetime) -> bool:
        """Assert this feature doesn't peek into the future."""
        assert self.data_cutoff <= sim_clock, (
            f"LOOK-AHEAD DETECTED: Feature '{self.name}' at sim_clock={sim_clock} "
            f"uses data from {self.data_cutoff} which is in the future!"
        )
        assert self.computed_at <= sim_clock, (
            f"TEMPORAL VIOLATION: Feature '{self.name}' computed at {self.computed_at} "
            f"but sim_clock is only {sim_clock}"
        )
        return True
```

---

## 5. Automated Bias Detection Tests

```python
import numpy as np
import pandas as pd
import pytest

class TestNoLookAheadBias:
    """
    Suite of automated tests to detect look-ahead bias.
    Run these against every feature computation pipeline.
    """

    def test_truncation_invariance(self, compute_features, price_data):
        """
        The strongest test: features at time t should be identical
        whether computed on data[:t+1] or data[:T] where T > t.

        If they differ, something is peeking into future data.
        """
        full_features = compute_features(price_data)

        # Test at 20 random points
        test_points = sorted(np.random.choice(
            range(250, len(price_data) - 1),
            size=20, replace=False
        ))

        for t in test_points:
            truncated_features = compute_features(price_data.iloc[:t + 1])

            for col in full_features.columns:
                full_val = full_features.iloc[t][col]
                trunc_val = truncated_features.iloc[-1][col]

                if pd.isna(full_val) and pd.isna(trunc_val):
                    continue

                assert np.isclose(full_val, trunc_val, rtol=1e-10, equal_nan=True), (
                    f"Look-ahead bias in '{col}' at index {t}: "
                    f"full={full_val}, truncated={trunc_val}"
                )

    def test_news_not_visible_before_next_bar(self, event_bus, news_items, price_bars):
        """
        Verify news at time t is not visible until bar at time > t.
        """
        # Push all events
        for bar in price_bars:
            event_bus.push(TimeEvent(bar.timestamp, 0, "price", bar))
        for news in news_items:
            event_bus.push(TimeEvent(news.published_at, 1, "news", news))

        prev_bar_time = None
        while True:
            bar, news_batch = event_bus.consume_next_bar()
            if bar is None:
                break

            for news_item in news_batch:
                assert news_item.published_at < bar.timestamp, (
                    f"News from {news_item.published_at} visible at bar "
                    f"{bar.timestamp} — should only be visible at a later bar!"
                )

            prev_bar_time = bar.timestamp

    def test_no_backward_fill(self, features_df):
        """
        Check that NaN gaps are not filled with future values.
        For each NaN followed by a value, the value should come from
        a prior row, not a later one.
        """
        for col in features_df.columns:
            series = features_df[col]
            first_valid = series.first_valid_index()
            if first_valid is None:
                continue

            # Before first_valid, all should be NaN (no backward fill)
            before = series.loc[:first_valid].iloc[:-1]
            assert before.isna().all(), (
                f"Column '{col}' has values before first valid index — "
                f"possible backward fill detected"
            )

    def test_rolling_min_periods(self, features_df, expected_warmup: int = 200):
        """
        Verify that features have appropriate NaN warmup periods.
        The first `expected_warmup` rows should have at least some NaN columns.
        """
        early_rows = features_df.iloc[:expected_warmup]
        has_nans = early_rows.isna().any(axis=1).any()
        assert has_nans, (
            f"No NaN values in first {expected_warmup} rows — "
            f"rolling windows may not be using min_periods correctly"
        )
```

---

## 6. Common Pitfalls Checklist

Before running any backtest, verify:

- [ ] All rolling computations use `min_periods=window_size`
- [ ] No `bfill()`, `interpolate()`, or other future-filling operations
- [ ] News events map to the next candle open, not the current one
- [ ] Weekend/holiday news maps to next trading session open
- [ ] Execution uses next bar's open (not current bar's close)
- [ ] Slippage and fees are applied to every trade
- [ ] Ticker universe is point-in-time (no survivorship bias)
- [ ] Train/test split uses purge gap (no overlapping features)
- [ ] No hyperparameter optimization on test data
- [ ] Truncation invariance test passes for all features

---

## 7. Dependencies

```toml
numpy = ">=1.26"
pandas = ">=2.2"
pytest = ">=8.0"
pydantic = ">=2.7"
```
