---
name: technical-indicators-pipeline
description: >-
  Compute technical analysis indicators for Indian equities with strict
  point-in-time enforcement. Use this skill when calculating RSI, VWAP,
  Bollinger Bands, MACD, EMA, ATR, OBV, or other technical features for
  the trading model's observation space. Also use when normalizing and
  scaling indicator values for model input, or when implementing vectorized
  rolling-window computations with pandas/numpy.
---

# Technical Indicators Pipeline

This skill covers computing, validating, and normalizing technical analysis
indicators that form the core of the Gymnasium environment's observation space.

---

## 1. Required Indicators

| Indicator | Parameters | Output | Purpose |
|---|---|---|---|
| RSI | period=14 | 0–100 | Momentum / overbought-oversold |
| VWAP | intraday reset | Price level | Fair value anchor |
| Bollinger Bands | period=20, std=2 | upper, middle, lower | Volatility bands |
| MACD | fast=12, slow=26, signal=9 | macd, signal, histogram | Trend momentum |
| EMA | periods=[9, 21, 50, 200] | Price level | Trend direction |
| ATR | period=14 | Volatility (INR) | Position sizing / stop-loss |
| OBV | cumulative | Volume flow | Volume-price confirmation |

---

## 2. Implementation — Vectorized with pandas

> **CRITICAL RULE**: All rolling computations must use `min_periods` equal to
> the window size. Never fill forward with NaN substitution — this would
> introduce look-ahead bias. The first `window_size - 1` rows must be NaN.

```python
import pandas as pd
import numpy as np

class TechnicalIndicators:
    """
    Compute technical indicators from OHLCV data.

    All methods are pure functions operating on pandas DataFrames.
    The input DataFrame must have columns: Open, High, Low, Close, Volume.
    Index must be a DatetimeIndex sorted ascending.
    """

    @staticmethod
    def rsi(close: pd.Series, period: int = 14) -> pd.Series:
        """
        Relative Strength Index.

        RSI = 100 - (100 / (1 + RS))
        RS = avg_gain / avg_loss over `period` bars.
        """
        delta = close.diff()
        gain = delta.where(delta > 0, 0.0)
        loss = -delta.where(delta < 0, 0.0)

        # Wilder's smoothed moving average
        avg_gain = gain.ewm(alpha=1/period, min_periods=period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1/period, min_periods=period, adjust=False).mean()

        rs = avg_gain / avg_loss.replace(0, np.nan)
        rsi = 100.0 - (100.0 / (1.0 + rs))
        return rsi.rename("RSI")

    @staticmethod
    def vwap(high: pd.Series, low: pd.Series, close: pd.Series,
             volume: pd.Series) -> pd.Series:
        """
        Volume-Weighted Average Price.

        For intraday: resets each day. For daily bars: cumulative from start.
        """
        typical_price = (high + low + close) / 3
        cumulative_tp_vol = (typical_price * volume).cumsum()
        cumulative_vol = volume.cumsum()
        vwap = cumulative_tp_vol / cumulative_vol.replace(0, np.nan)
        return vwap.rename("VWAP")

    @staticmethod
    def bollinger_bands(
        close: pd.Series, period: int = 20, num_std: float = 2.0
    ) -> pd.DataFrame:
        """
        Bollinger Bands: middle ± num_std * rolling_std.
        """
        middle = close.rolling(window=period, min_periods=period).mean()
        std = close.rolling(window=period, min_periods=period).std()
        upper = middle + (num_std * std)
        lower = middle - (num_std * std)
        return pd.DataFrame({
            "BB_upper": upper,
            "BB_middle": middle,
            "BB_lower": lower,
            "BB_width": (upper - lower) / middle,  # Normalized bandwidth
        })

    @staticmethod
    def macd(
        close: pd.Series,
        fast: int = 12, slow: int = 26, signal: int = 9
    ) -> pd.DataFrame:
        """MACD line, signal line, and histogram."""
        ema_fast = close.ewm(span=fast, min_periods=fast, adjust=False).mean()
        ema_slow = close.ewm(span=slow, min_periods=slow, adjust=False).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal, min_periods=signal, adjust=False).mean()
        histogram = macd_line - signal_line
        return pd.DataFrame({
            "MACD": macd_line,
            "MACD_signal": signal_line,
            "MACD_hist": histogram,
        })

    @staticmethod
    def ema(close: pd.Series, period: int) -> pd.Series:
        """Exponential Moving Average."""
        return close.ewm(span=period, min_periods=period, adjust=False).mean().rename(f"EMA_{period}")

    @staticmethod
    def atr(
        high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14
    ) -> pd.Series:
        """
        Average True Range — measure of volatility.

        TR = max(H-L, |H-prev_C|, |L-prev_C|)
        ATR = Wilder's smoothed average of TR over `period`.
        """
        prev_close = close.shift(1)
        tr1 = high - low
        tr2 = (high - prev_close).abs()
        tr3 = (low - prev_close).abs()
        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = true_range.ewm(alpha=1/period, min_periods=period, adjust=False).mean()
        return atr.rename("ATR")

    @staticmethod
    def obv(close: pd.Series, volume: pd.Series) -> pd.Series:
        """
        On-Balance Volume — cumulative volume flow.

        OBV += volume if close > prev_close, else -= volume.
        """
        direction = np.sign(close.diff())
        obv = (direction * volume).cumsum()
        return obv.rename("OBV")

    @classmethod
    def compute_all(cls, df: pd.DataFrame) -> pd.DataFrame:
        """
        Compute all technical indicators and return a combined feature DataFrame.

        Args:
            df: OHLCV DataFrame with columns [Open, High, Low, Close, Volume].

        Returns:
            DataFrame with all indicator columns. First rows will have NaN
            due to lookback requirements — this is correct behavior.
        """
        features = pd.DataFrame(index=df.index)

        # Momentum
        features["RSI"] = cls.rsi(df["Close"])

        # Trend
        macd_df = cls.macd(df["Close"])
        features = features.join(macd_df)

        for period in [9, 21, 50, 200]:
            features[f"EMA_{period}"] = cls.ema(df["Close"], period)

        # Volatility
        bb_df = cls.bollinger_bands(df["Close"])
        features = features.join(bb_df)
        features["ATR"] = cls.atr(df["High"], df["Low"], df["Close"])

        # Volume
        features["VWAP"] = cls.vwap(df["High"], df["Low"], df["Close"], df["Volume"])
        features["OBV"] = cls.obv(df["Close"], df["Volume"])

        # Price-relative features (normalize to current close)
        features["close_to_vwap"] = df["Close"] / features["VWAP"] - 1
        features["close_to_bb_upper"] = df["Close"] / features["BB_upper"] - 1
        features["close_to_bb_lower"] = df["Close"] / features["BB_lower"] - 1

        return features
```

---

## 3. Feature Normalization

Before feeding into the model, normalize features to comparable scales:

```python
class FeatureNormalizer:
    """
    Rolling z-score normalization for technical features.
    Uses a lookback window to avoid future data leakage.
    """

    def __init__(self, lookback: int = 252):
        """
        Args:
            lookback: Number of bars for rolling mean/std calculation.
                      252 ≈ 1 trading year for daily bars.
        """
        self.lookback = lookback

    def normalize(self, features: pd.DataFrame) -> pd.DataFrame:
        """
        Apply rolling z-score normalization.

        z = (x - rolling_mean) / rolling_std

        NaN values in the first `lookback` rows are expected and correct.
        """
        rolling_mean = features.rolling(
            window=self.lookback, min_periods=self.lookback
        ).mean()
        rolling_std = features.rolling(
            window=self.lookback, min_periods=self.lookback
        ).std()

        # Avoid division by zero
        rolling_std = rolling_std.replace(0, np.nan)

        normalized = (features - rolling_mean) / rolling_std

        # Clip extreme values to ±5 sigma
        normalized = normalized.clip(-5, 5)

        return normalized
```

---

## 4. Point-in-Time Validation

```python
def validate_no_future_leak(features: pd.DataFrame, prices: pd.DataFrame) -> None:
    """
    Assert that no feature at time t uses data from t+1 or later.

    Verification approach:
    1. Compute features on full dataset
    2. Compute features on dataset truncated at each point
    3. Assert values match at the truncation point
    """
    # Spot-check 10 random points
    check_points = sorted(np.random.choice(
        range(200, len(features) - 1), size=min(10, len(features) - 201), replace=False
    ))

    for t in check_points:
        truncated_prices = prices.iloc[:t+1]
        truncated_features = TechnicalIndicators.compute_all(truncated_prices)

        full_row = features.iloc[t]
        trunc_row = truncated_features.iloc[t]

        for col in features.columns:
            if pd.isna(full_row[col]) and pd.isna(trunc_row[col]):
                continue
            assert np.isclose(full_row[col], trunc_row[col], rtol=1e-10), (
                f"Look-ahead bias detected in {col} at index {t}: "
                f"full={full_row[col]}, truncated={trunc_row[col]}"
            )
```

---

## 5. Dependencies

```toml
pandas = ">=2.2"
numpy = ">=1.26"
```

> **Note**: This pipeline uses pure pandas/numpy. If `ta-lib` is available
> (requires C library), it can be used for performance, but the pure-Python
> implementation above is the portable default.
