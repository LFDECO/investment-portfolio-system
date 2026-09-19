"""
Fast Vectorized Candlestick Buffer for Gymnasium Simulation & RL Loops.

Eliminates Pydantic model validation and object allocation overhead in hot loops.
Data is validated ONCE at the ingestion boundary via PriceBar, then stored in
contiguous C-ordered NumPy arrays for zero-overhead integer-indexed simulation steps.
"""

from datetime import datetime
from typing import NamedTuple

import numpy as np

from .schemas import PriceBar


class FastBarTuple(NamedTuple):
    """Lightweight immutable tuple for step returns without Pydantic validation overhead."""

    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


class FastBarBuffer:
    """
    High-performance contiguous memory bar buffer for Gymnasium trading env.

    Memory Layout:
        matrix: np.ndarray of shape (N, 5) with float64 columns:
                [0: open, 1: high, 2: low, 3: close, 4: volume]
        timestamps: np.ndarray of shape (N,) with int64 unix timestamps (seconds).
    """

    __slots__ = (
        "ticker",
        "timestamps",
        "opens",
        "highs",
        "lows",
        "closes",
        "volumes",
        "matrix",
        "_dts",
        "_length",
    )

    def __init__(
        self,
        ticker: str,
        timestamps: np.ndarray,
        opens: np.ndarray,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        volumes: np.ndarray,
        dts: list[datetime],
    ) -> None:
        self.ticker = ticker
        self.timestamps = timestamps
        self.opens = opens
        self.highs = highs
        self.lows = lows
        self.closes = closes
        self.volumes = volumes
        self._dts = dts
        self._length = len(timestamps)

        # Pre-stack 2D contiguous matrix for vectorized observation window slicing
        self.matrix = np.column_stack(
            (self.opens, self.highs, self.lows, self.closes, self.volumes)
        ).astype(np.float64, order="C")

    @classmethod
    def from_bars(cls, bars: list[PriceBar]) -> "FastBarBuffer":
        """
        Construct a FastBarBuffer from validated Pydantic PriceBar objects.
        Validates at the boundary once; subsequent steps access raw arrays.
        """
        if not bars:
            empty_f64 = np.empty(0, dtype=np.float64)
            empty_i64 = np.empty(0, dtype=np.int64)
            return cls("", empty_i64, empty_f64, empty_f64, empty_f64, empty_f64, empty_f64, [])

        ticker = bars[0].ticker
        n = len(bars)

        timestamps = np.empty(n, dtype=np.int64)
        opens = np.empty(n, dtype=np.float64)
        highs = np.empty(n, dtype=np.float64)
        lows = np.empty(n, dtype=np.float64)
        closes = np.empty(n, dtype=np.float64)
        volumes = np.empty(n, dtype=np.float64)
        dts: list[datetime] = []

        for i, b in enumerate(bars):
            timestamps[i] = int(b.timestamp.timestamp())
            opens[i] = b.open
            highs[i] = b.high
            lows[i] = b.low
            closes[i] = b.close
            volumes[i] = b.volume
            dts.append(b.timestamp)

        return cls(ticker, timestamps, opens, highs, lows, closes, volumes, dts)

    def __len__(self) -> int:
        return self._length

    def get_bar(self, idx: int) -> FastBarTuple:
        """Fetch a single bar at step index in O(1) time."""
        if idx < 0 or idx >= self._length:
            raise IndexError(f"Index {idx} out of bounds for buffer length {self._length}")
        return FastBarTuple(
            timestamp=self._dts[idx],
            open=float(self.opens[idx]),
            high=float(self.highs[idx]),
            low=float(self.lows[idx]),
            close=float(self.closes[idx]),
            volume=float(self.volumes[idx]),
        )

    def get_window(self, end_idx: int, window_size: int) -> np.ndarray:
        """
        Extract an observation window of shape (window_size, 5) ending at end_idx.
        Pads with the earliest available bar if end_idx < window_size.
        """
        if end_idx < 0 or end_idx >= self._length:
            raise IndexError(f"End index {end_idx} out of bounds")
        if window_size <= 0:
            raise ValueError(f"window_size must be positive, got {window_size}")

        start_idx = end_idx - window_size + 1
        if start_idx >= 0:
            return self.matrix[start_idx : end_idx + 1]

        # Pad with initial bar if historical warm-up window is insufficient
        pad_count = -start_idx
        pad_row = self.matrix[0:1]
        padding = np.repeat(pad_row, pad_count, axis=0)
        actual = self.matrix[0 : end_idx + 1]
        return np.vstack((padding, actual))
