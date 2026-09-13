---
name: gymnasium-trading-env
description: >-
  Build a custom Farama Gymnasium trading simulation environment with Indian
  market realism. Use this skill when creating the step-based trading
  environment, defining observation and action spaces, implementing Indian
  brokerage fee models (STT, GST, SEBI charges, stamp duty), modeling
  dynamic bid-ask spreads, or applying slippage penalties proportional to
  order size vs. volume. Also use for the env reset/step/render lifecycle.
---

# Gymnasium Trading Environment — Indian Markets

This skill covers building a realistic, step-based trading simulation
environment using the Farama Gymnasium interface, tailored for Indian equities.

---

## 1. Environment Architecture

```
┌─────────────────────────────────────────────┐
│                 TradingEnv                   │
│  gymnasium.Env                               │
│                                              │
│  Observation Space:                          │
│    [technical_indicators | sentiment_vector] │
│                                              │
│  Action Space:                               │
│    Discrete(5) or Box([-1, 1])              │
│                                              │
│  Reward: risk-adjusted PnL                   │
│  Done: end of data window or bankruptcy      │
│                                              │
│  Internal State:                             │
│    - Portfolio (cash + positions)             │
│    - Fee model (Indian brokerage)            │
│    - Slippage model                          │
│    - Step counter / simulation clock         │
└─────────────────────────────────────────────┘
```

---

## 2. Indian Brokerage Fee Model

All fees are modeled on the **discount brokerage** structure (Zerodha-like flat fee).
These are applied per-trade in the simulation.

```python
from pydantic import BaseModel, Field
from decimal import Decimal

class IndianBrokerageFees(BaseModel):
    """
    Indian equity delivery and intraday fee structure.
    All rates are per-transaction unless noted.

    Based on NSE equity segment, discount broker model (2024-25 rates).
    """
    # Brokerage
    delivery_brokerage_pct: Decimal = Field(default=Decimal("0.0"), description="Delivery: ₹0 or flat ₹20")
    intraday_brokerage_flat: Decimal = Field(default=Decimal("20.0"), description="Flat ₹20 per executed order")

    # Regulatory charges
    stt_delivery_buy_pct: Decimal = Field(default=Decimal("0.1"), description="STT on buy delivery: 0.1% of turnover")
    stt_delivery_sell_pct: Decimal = Field(default=Decimal("0.1"), description="STT on sell delivery: 0.1% of turnover")
    stt_intraday_sell_pct: Decimal = Field(default=Decimal("0.025"), description="STT on intraday sell: 0.025%")

    # Exchange transaction charges
    nse_txn_charge_pct: Decimal = Field(default=Decimal("0.00297"), description="NSE transaction charge: 0.00297%")

    # SEBI turnover fee
    sebi_fee_pct: Decimal = Field(default=Decimal("0.0001"), description="SEBI charges: ₹10 per crore = 0.0001%")

    # GST
    gst_pct: Decimal = Field(default=Decimal("18.0"), description="GST: 18% on brokerage + transaction charges")

    # Stamp duty (buy side only)
    stamp_duty_pct: Decimal = Field(default=Decimal("0.015"), description="Stamp duty on buy: 0.015% of turnover")

    # DP charges (delivery sell only)
    dp_charges: Decimal = Field(default=Decimal("15.93"), description="Flat DP charge per sell script: ₹15.93")


def calculate_transaction_cost(
    fees: IndianBrokerageFees,
    trade_value: Decimal,
    is_buy: bool,
    is_intraday: bool = False,
) -> Decimal:
    """
    Calculate total transaction cost for an Indian equity trade.

    Args:
        fees: Fee structure to apply.
        trade_value: Absolute trade value in INR.
        is_buy: True for buy, False for sell.
        is_intraday: True for intraday, False for delivery.

    Returns:
        Total transaction cost in INR.
    """
    cost = Decimal("0")

    # Brokerage (flat ₹20 for intraday; ₹0 for delivery at discount broker)
    brokerage = fees.intraday_brokerage_flat if is_intraday else Decimal("0")
    cost += brokerage

    # STT
    if is_intraday:
        if not is_buy:  # STT only on sell for intraday
            cost += trade_value * fees.stt_intraday_sell_pct / 100
    else:
        # Delivery: STT on both buy and sell
        rate = fees.stt_delivery_buy_pct if is_buy else fees.stt_delivery_sell_pct
        cost += trade_value * rate / 100

    # Exchange transaction charges
    txn_charge = trade_value * fees.nse_txn_charge_pct / 100
    cost += txn_charge

    # SEBI fee
    cost += trade_value * fees.sebi_fee_pct / 100

    # GST on brokerage + transaction charges
    gst_base = brokerage + txn_charge
    cost += gst_base * fees.gst_pct / 100

    # Stamp duty (buy side only)
    if is_buy:
        cost += trade_value * fees.stamp_duty_pct / 100

    # DP charges (delivery sell only)
    if not is_intraday and not is_buy:
        cost += fees.dp_charges

    return cost.quantize(Decimal("0.01"))
```

---

## 3. Slippage Model

```python
import numpy as np

def calculate_slippage(
    order_size: int,
    avg_volume: int,
    current_price: float,
    spread_bps: float = 5.0,
) -> float:
    """
    Estimate slippage as a function of order size relative to volume.

    Args:
        order_size: Number of shares in the order.
        avg_volume: Average daily volume for the stock.
        current_price: Current market price.
        spread_bps: Typical bid-ask spread in basis points.

    Returns:
        Slippage cost in INR (always positive — a cost).
    """
    if avg_volume == 0:
        return current_price * 0.01  # 1% penalty for illiquid stocks

    participation_rate = order_size / avg_volume

    # Square-root market impact model (Almgren-Chriss simplified)
    # Impact ∝ σ * √(participation_rate)
    volatility_proxy = spread_bps / 10000  # Use spread as vol proxy
    impact_bps = volatility_proxy * np.sqrt(participation_rate) * 10000

    # Add half-spread as baseline cost
    total_bps = (spread_bps / 2) + impact_bps

    return current_price * total_bps / 10000
```

---

## 4. Gymnasium Environment Implementation

```python
import gymnasium as gym
from gymnasium import spaces
import numpy as np

class TradingEnv(gym.Env):
    """
    Custom Gymnasium environment for Indian equity trading simulation.

    Observation Space:
        Combined vector of technical indicators and sentiment features.
        Shape: (num_features,) where num_features = tech_features + sentiment_features

    Action Space (Discrete mode):
        0: Strong Short (-100% target)
        1: Short (-50% target)
        2: Neutral (0% — hold cash)
        3: Long (+50% target)
        4: Strong Long (+100% target)

    Reward:
        Risk-adjusted step PnL minus transaction costs.
    """

    metadata = {"render_modes": ["human", "json"]}

    # Action-to-target-weight mapping
    ACTION_WEIGHTS = {
        0: -1.0,   # Strong Short
        1: -0.5,   # Short
        2:  0.0,   # Neutral
        3:  0.5,   # Long
        4:  1.0,   # Strong Long
    }

    def __init__(
        self,
        price_data: np.ndarray,          # Shape: (T, OHLCV=5)
        feature_data: np.ndarray,         # Shape: (T, num_features)
        initial_cash: float = 1_000_000,  # ₹10 lakh default
        fee_model: IndianBrokerageFees | None = None,
        render_mode: str | None = None,
    ):
        super().__init__()

        self.price_data = price_data
        self.feature_data = feature_data
        self.initial_cash = initial_cash
        self.fee_model = fee_model or IndianBrokerageFees()
        self.render_mode = render_mode

        self.n_steps = len(price_data)
        self.n_features = feature_data.shape[1]

        # Spaces
        self.action_space = spaces.Discrete(5)
        self.observation_space = spaces.Box(
            low=-np.inf, high=np.inf,
            shape=(self.n_features + 3,),  # features + [cash_ratio, position_ratio, unrealized_pnl_pct]
            dtype=np.float32,
        )

        # State
        self._step_idx = 0
        self._cash = initial_cash
        self._position = 0  # Number of shares held (negative = short)
        self._portfolio_value_history: list[float] = []
        self._trade_log: list[dict] = []

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self._step_idx = 0
        self._cash = self.initial_cash
        self._position = 0
        self._portfolio_value_history = [self.initial_cash]
        self._trade_log = []
        return self._get_obs(), self._get_info()

    def step(self, action: int):
        assert self.action_space.contains(action)

        current_price = float(self.price_data[self._step_idx, 3])  # Close price
        current_volume = int(self.price_data[self._step_idx, 4])

        # Determine target position weight
        target_weight = self.ACTION_WEIGHTS[action]
        portfolio_value = self._cash + self._position * current_price
        target_shares = int(target_weight * portfolio_value / current_price) if current_price > 0 else 0

        # Execute trade if position change needed
        trade_shares = target_shares - self._position
        if trade_shares != 0:
            self._execute_trade(trade_shares, current_price, current_volume)

        # Advance step
        self._step_idx += 1
        terminated = self._step_idx >= self.n_steps - 1
        truncated = False

        # Calculate reward
        new_portfolio_value = self._cash + self._position * float(self.price_data[min(self._step_idx, self.n_steps - 1), 3])
        step_return = (new_portfolio_value - self._portfolio_value_history[-1]) / self._portfolio_value_history[-1]
        self._portfolio_value_history.append(new_portfolio_value)

        reward = step_return  # Can be replaced with risk-adjusted metric

        # Check bankruptcy
        if new_portfolio_value <= 0:
            terminated = True
            reward = -10.0  # Large penalty

        obs = self._get_obs() if not terminated else np.zeros(self.observation_space.shape, dtype=np.float32)
        return obs, reward, terminated, truncated, self._get_info()

    def _execute_trade(self, shares: int, price: float, volume: int):
        """Execute a trade with fees and slippage."""
        from decimal import Decimal

        is_buy = shares > 0
        abs_shares = abs(shares)
        slippage = calculate_slippage(abs_shares, volume, price)
        fill_price = price + slippage if is_buy else price - slippage

        trade_value = Decimal(str(abs_shares * fill_price))
        cost = calculate_transaction_cost(self.fee_model, trade_value, is_buy)

        if is_buy:
            self._cash -= float(trade_value) + float(cost)
        else:
            self._cash += float(trade_value) - float(cost)

        self._position += shares

        self._trade_log.append({
            "step": self._step_idx,
            "action": "BUY" if is_buy else "SELL",
            "shares": abs_shares,
            "price": price,
            "fill_price": fill_price,
            "slippage": slippage,
            "fees": float(cost),
            "trade_value": float(trade_value),
        })

    def _get_obs(self) -> np.ndarray:
        if self._step_idx >= self.n_steps:
            return np.zeros(self.observation_space.shape, dtype=np.float32)

        features = self.feature_data[self._step_idx]
        current_price = float(self.price_data[self._step_idx, 3])
        portfolio_value = self._cash + self._position * current_price

        augmented = np.concatenate([
            features,
            [
                self._cash / portfolio_value if portfolio_value > 0 else 1.0,
                (self._position * current_price) / portfolio_value if portfolio_value > 0 else 0.0,
                (portfolio_value - self.initial_cash) / self.initial_cash,
            ],
        ]).astype(np.float32)
        return augmented

    def _get_info(self) -> dict:
        return {
            "step": self._step_idx,
            "cash": self._cash,
            "position": self._position,
            "portfolio_value": self._portfolio_value_history[-1] if self._portfolio_value_history else self.initial_cash,
            "trade_count": len(self._trade_log),
        }
```

---

## 5. Indian Market Circuit Breakers

Indian exchanges enforce circuit breakers. The environment should respect these:

| Circuit Level | NIFTY Movement | Trading Halt |
|---|---|---|
| Level 1 | ±10% | 45 min (before 1 PM), 15 min (1-2:30 PM), none (after 2:30 PM) |
| Level 2 | ±15% | 1h 45m (before 1 PM), 45 min (after 1 PM) |
| Level 3 | ±20% | Remainder of day |

Individual stock circuit limits: ±5%, ±10%, or ±20% depending on the stock's band.

---

## 6. Dependencies

```toml
gymnasium = ">=0.29"
numpy = ">=1.26"
pydantic = ">=2.7"
```

For technical indicators used in observation space, see the `technical-indicators-pipeline` skill.
