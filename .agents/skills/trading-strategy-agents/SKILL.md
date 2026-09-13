---
name: trading-strategy-agents
description: >-
  Design and implement baseline heuristic and machine-learning trading
  strategy agents. Use this skill when creating momentum, mean-reversion,
  or sentiment-threshold strategies, defining the abstract strategy
  interface, implementing position sizing and risk limits, or integrating
  reinforcement learning agents (Stable-Baselines3). Also use when handling
  Indian market circuit breaker constraints in strategy logic.
---

# Trading Strategy Agents

This skill covers designing, implementing, and evaluating trading strategies
that operate within the Gymnasium trading environment.

---

## 1. Strategy Interface Contract

All strategies must implement this abstract base class to ensure compatibility
with the backtesting and environment systems.

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
import numpy as np

@dataclass
class StrategyConfig:
    """Configuration shared across all strategies."""
    max_position_pct: float = 1.0         # Max fraction of portfolio in single stock
    max_drawdown_pct: float = 0.20        # Kill-switch: stop trading if drawdown > 20%
    risk_per_trade_pct: float = 0.02      # Max 2% of portfolio risked per trade
    circuit_limit_buffer: float = 0.005   # Stay 0.5% away from circuit limits

class BaseStrategy(ABC):
    """
    Abstract base class for all trading strategies.

    Strategies receive an observation vector and return an action
    compatible with the TradingEnv action space.
    """

    def __init__(self, config: StrategyConfig | None = None):
        self.config = config or StrategyConfig()
        self._trade_count = 0

    @abstractmethod
    def act(self, observation: np.ndarray, info: dict) -> int:
        """
        Select an action given the current observation.

        Args:
            observation: Feature vector from TradingEnv.
            info: Additional info dict from env.step().

        Returns:
            Action integer (0-4 for discrete action space).
        """
        ...

    @abstractmethod
    def reset(self) -> None:
        """Reset internal state for a new episode."""
        ...

    def should_stop(self, info: dict) -> bool:
        """
        Kill-switch: halt trading if max drawdown is breached.
        """
        portfolio_value = info.get("portfolio_value", 0)
        initial_value = info.get("initial_value", portfolio_value)
        if initial_value <= 0:
            return True
        drawdown = (initial_value - portfolio_value) / initial_value
        return drawdown > self.config.max_drawdown_pct
```

---

## 2. Baseline Strategies

### 2a. Momentum Strategy

```python
class MomentumStrategy(BaseStrategy):
    """
    Simple momentum strategy using RSI and EMA crossover.

    Rules:
    - Long when RSI < 30 AND short EMA > long EMA (oversold in uptrend)
    - Short when RSI > 70 AND short EMA < long EMA (overbought in downtrend)
    - Neutral otherwise

    Feature indices (must match TechnicalIndicators.compute_all() output order):
    - RSI at index 0
    - EMA_9 at index 4
    - EMA_21 at index 5
    """

    def __init__(
        self,
        rsi_idx: int = 0,
        ema_short_idx: int = 4,
        ema_long_idx: int = 5,
        rsi_oversold: float = 30.0,
        rsi_overbought: float = 70.0,
        config: StrategyConfig | None = None,
    ):
        super().__init__(config)
        self.rsi_idx = rsi_idx
        self.ema_short_idx = ema_short_idx
        self.ema_long_idx = ema_long_idx
        self.rsi_oversold = rsi_oversold
        self.rsi_overbought = rsi_overbought

    def act(self, observation: np.ndarray, info: dict) -> int:
        if self.should_stop(info):
            return 2  # Neutral

        rsi = observation[self.rsi_idx]
        ema_short = observation[self.ema_short_idx]
        ema_long = observation[self.ema_long_idx]

        if rsi < self.rsi_oversold and ema_short > ema_long:
            return 4  # Strong Long
        elif rsi < 40 and ema_short > ema_long:
            return 3  # Long
        elif rsi > self.rsi_overbought and ema_short < ema_long:
            return 0  # Strong Short
        elif rsi > 60 and ema_short < ema_long:
            return 1  # Short
        else:
            return 2  # Neutral

    def reset(self) -> None:
        self._trade_count = 0
```

### 2b. Mean Reversion Strategy

```python
class MeanReversionStrategy(BaseStrategy):
    """
    Mean reversion using Bollinger Band breakouts.

    Rules:
    - Long when price drops below lower Bollinger Band (expect reversion up)
    - Short when price rises above upper Bollinger Band (expect reversion down)
    - Neutral when price is within bands

    Feature indices:
    - close_to_bb_upper at index -3 (relative features appended last)
    - close_to_bb_lower at index -2
    """

    def __init__(
        self,
        bb_upper_idx: int = -3,
        bb_lower_idx: int = -2,
        threshold: float = 0.0,
        config: StrategyConfig | None = None,
    ):
        super().__init__(config)
        self.bb_upper_idx = bb_upper_idx
        self.bb_lower_idx = bb_lower_idx
        self.threshold = threshold

    def act(self, observation: np.ndarray, info: dict) -> int:
        if self.should_stop(info):
            return 2

        close_to_upper = observation[self.bb_upper_idx]
        close_to_lower = observation[self.bb_lower_idx]

        if close_to_lower < -self.threshold:  # Below lower band
            return 4  # Strong Long (expect reversion up)
        elif close_to_upper > self.threshold:  # Above upper band
            return 0  # Strong Short (expect reversion down)
        else:
            return 2  # Neutral

    def reset(self) -> None:
        self._trade_count = 0
```

### 2c. Sentiment-Threshold Strategy

```python
class SentimentStrategy(BaseStrategy):
    """
    Trade based on sentiment signals.

    Uses the sentiment feature vector from the FinBERT pipeline.
    Requires sentiment features to be appended after technical indicators
    in the observation space.

    Sentiment feature indices (relative to sentiment block start):
    - raw_sentiment: offset 0
    - sentiment_delta_24h: offset 1
    - chatter_velocity_zscore: offset 2
    """

    def __init__(
        self,
        sentiment_start_idx: int = -6,  # Adjust based on feature layout
        bullish_threshold: float = 0.3,
        bearish_threshold: float = -0.3,
        velocity_threshold: float = 2.0,
        config: StrategyConfig | None = None,
    ):
        super().__init__(config)
        self.sentiment_start_idx = sentiment_start_idx
        self.bullish_threshold = bullish_threshold
        self.bearish_threshold = bearish_threshold
        self.velocity_threshold = velocity_threshold

    def act(self, observation: np.ndarray, info: dict) -> int:
        if self.should_stop(info):
            return 2

        raw_sent = observation[self.sentiment_start_idx]
        sent_delta = observation[self.sentiment_start_idx + 1]
        velocity_z = observation[self.sentiment_start_idx + 2]

        # Strong signal: high sentiment + accelerating + high velocity
        if (raw_sent > self.bullish_threshold
                and sent_delta > 0
                and velocity_z > self.velocity_threshold):
            return 4  # Strong Long

        if (raw_sent < self.bearish_threshold
                and sent_delta < 0
                and velocity_z > self.velocity_threshold):
            return 0  # Strong Short

        # Moderate signals
        if raw_sent > self.bullish_threshold:
            return 3  # Long
        if raw_sent < self.bearish_threshold:
            return 1  # Short

        return 2  # Neutral

    def reset(self) -> None:
        self._trade_count = 0
```

---

## 3. RL Agent Integration (Stable-Baselines3)

```python
from stable_baselines3 import PPO, A2C, DQN

class RLStrategyWrapper(BaseStrategy):
    """
    Wraps a trained Stable-Baselines3 model as a BaseStrategy.

    Usage:
        model = PPO.load("ppo_trading_agent")
        strategy = RLStrategyWrapper(model)
    """

    def __init__(self, model, config: StrategyConfig | None = None):
        super().__init__(config)
        self.model = model

    def act(self, observation: np.ndarray, info: dict) -> int:
        if self.should_stop(info):
            return 2
        action, _ = self.model.predict(observation, deterministic=True)
        return int(action)

    def reset(self) -> None:
        self._trade_count = 0

# Training example:
# env = TradingEnv(price_data, feature_data)
# model = PPO("MlpPolicy", env, verbose=1, learning_rate=3e-4)
# model.learn(total_timesteps=100_000)
# model.save("ppo_trading_agent")
```

---

## 4. Position Sizing with ATR

```python
def atr_position_size(
    portfolio_value: float,
    risk_per_trade_pct: float,
    atr: float,
    current_price: float,
    atr_multiplier: float = 2.0,
) -> int:
    """
    Calculate position size using ATR-based risk management.

    Position Size = (Portfolio * Risk%) / (ATR * Multiplier)

    Args:
        portfolio_value: Current portfolio value in INR.
        risk_per_trade_pct: Fraction of portfolio to risk (e.g., 0.02 = 2%).
        atr: Current ATR value in INR.
        current_price: Current stock price.
        atr_multiplier: Stop-loss distance in ATR units.

    Returns:
        Number of shares to trade.
    """
    if atr <= 0 or current_price <= 0:
        return 0

    risk_amount = portfolio_value * risk_per_trade_pct
    stop_distance = atr * atr_multiplier
    shares = int(risk_amount / stop_distance)

    # Cap at affordable shares
    max_shares = int(portfolio_value / current_price)
    return min(shares, max_shares)
```

---

## 5. Indian Market Circuit Breaker Guard

```python
def check_circuit_limit(
    current_price: float,
    prev_close: float,
    circuit_band_pct: float = 0.20,
    buffer_pct: float = 0.005,
) -> dict:
    """
    Check if a stock is near its circuit limit.

    Returns dict with upper/lower limits and whether trading should be avoided.
    """
    upper_limit = prev_close * (1 + circuit_band_pct)
    lower_limit = prev_close * (1 - circuit_band_pct)
    buffer = prev_close * buffer_pct

    near_upper = current_price >= (upper_limit - buffer)
    near_lower = current_price <= (lower_limit + buffer)

    return {
        "upper_limit": upper_limit,
        "lower_limit": lower_limit,
        "near_upper_circuit": near_upper,
        "near_lower_circuit": near_lower,
        "should_avoid_buy": near_upper,   # Don't buy near upper circuit
        "should_avoid_sell": near_lower,   # Don't sell near lower circuit
    }
```

---

## 6. Dependencies

```toml
numpy = ">=1.26"
stable-baselines3 = ">=2.3"  # Optional, for RL agents
```
