---
name: trade-telemetry-analytics
description: >-
  Build per-trade JSON telemetry logging and automated performance analytics.
  Use this skill when implementing trade logging with sentiment/technical
  trigger capture, computing Sharpe Ratio, Sortino Ratio, Maximum Drawdown,
  Win-Loss Ratio, Profit Factor, and Calmar Ratio, generating equity curve
  and drawdown underwater plots, or creating QuantStats HTML reports. Also
  use for factor importance attribution and decision explainability logging.
---

# Trade Telemetry & Analytics

This skill covers the complete telemetry, performance measurement, and
explainability system for the trading simulation.

---

## 1. Per-Trade Telemetry Schema

Every trade executed by the simulation must be logged with full context.

```python
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

class OrderSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"

class TradeTelemetry(BaseModel):
    """Complete record of a single trade execution with decision context."""

    # Identity
    trade_id: str = Field(..., description="Unique trade identifier (nanoid)")
    strategy_name: str
    ticker: str
    timestamp: datetime

    # Execution
    side: OrderSide
    quantity: int
    target_price: float = Field(..., description="Price at decision time")
    fill_price: float = Field(..., description="Actual fill after slippage")
    slippage_inr: float
    fees_inr: float
    total_cost_inr: float

    # Portfolio context
    portfolio_value_before: float
    portfolio_value_after: float
    cash_before: float
    cash_after: float
    position_before: int
    position_after: int

    # Decision triggers — what caused this trade
    rsi_at_entry: float | None = None
    macd_signal: str | None = None  # "bullish_cross", "bearish_cross", etc.
    bb_position: str | None = None  # "below_lower", "above_upper", "within"
    sentiment_score: float | None = None
    sentiment_delta: float | None = None
    chatter_zscore: float | None = None
    action_taken: int  # 0-4 action from env

    # Attribution
    primary_trigger: str = Field(..., description="Main reason for trade: 'momentum', 'sentiment', 'mean_reversion', 'rl_policy'")


class TelemetryLogger:
    """
    JSON-lines telemetry logger for trade execution records.

    Writes one JSON object per line to a .jsonl file for easy streaming
    and downstream analysis.
    """

    def __init__(self, output_path: str):
        self.output_path = output_path
        self._file = open(output_path, "a")

    def log(self, telemetry: TradeTelemetry) -> None:
        self._file.write(telemetry.model_dump_json() + "\n")
        self._file.flush()

    def close(self) -> None:
        self._file.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
```

---

## 2. Performance Metrics Calculator

```python
import numpy as np
import pandas as pd

class PerformanceMetrics:
    """
    Calculate standard quantitative performance metrics from an equity curve.

    All return inputs should be simple (not log) daily returns.
    """

    @staticmethod
    def sharpe_ratio(
        returns: np.ndarray,
        risk_free_rate: float = 0.065,  # India 10Y G-Sec ~6.5%
        periods: int = 252,
    ) -> float:
        """
        Annualized Sharpe Ratio.

        Sharpe = (mean_excess_return / std_return) * sqrt(periods)
        """
        daily_rf = risk_free_rate / periods
        excess = returns - daily_rf
        if np.std(excess) == 0:
            return 0.0
        return float(np.mean(excess) / np.std(excess) * np.sqrt(periods))

    @staticmethod
    def sortino_ratio(
        returns: np.ndarray,
        risk_free_rate: float = 0.065,
        periods: int = 252,
    ) -> float:
        """
        Annualized Sortino Ratio — penalizes only downside volatility.

        Sortino = (mean_excess_return / downside_std) * sqrt(periods)
        """
        daily_rf = risk_free_rate / periods
        excess = returns - daily_rf
        downside = excess[excess < 0]
        downside_std = np.std(downside) if len(downside) > 0 else 1e-10
        return float(np.mean(excess) / downside_std * np.sqrt(periods))

    @staticmethod
    def max_drawdown(equity_curve: np.ndarray) -> float:
        """
        Maximum drawdown as a fraction (e.g., 0.25 = 25% drawdown).
        """
        peak = np.maximum.accumulate(equity_curve)
        drawdown = (peak - equity_curve) / peak
        return float(np.max(drawdown))

    @staticmethod
    def calmar_ratio(
        returns: np.ndarray,
        equity_curve: np.ndarray,
        periods: int = 252,
    ) -> float:
        """
        Calmar Ratio = Annualized Return / Max Drawdown.
        """
        ann_return = float(np.mean(returns) * periods)
        mdd = PerformanceMetrics.max_drawdown(equity_curve)
        return ann_return / mdd if mdd > 0 else 0.0

    @staticmethod
    def win_loss_ratio(trade_pnls: np.ndarray) -> dict:
        """
        Win/Loss statistics from individual trade PnLs.
        """
        wins = trade_pnls[trade_pnls > 0]
        losses = trade_pnls[trade_pnls < 0]

        return {
            "total_trades": len(trade_pnls),
            "winning_trades": len(wins),
            "losing_trades": len(losses),
            "win_rate": len(wins) / len(trade_pnls) if len(trade_pnls) > 0 else 0,
            "avg_win": float(np.mean(wins)) if len(wins) > 0 else 0,
            "avg_loss": float(np.mean(losses)) if len(losses) > 0 else 0,
            "largest_win": float(np.max(wins)) if len(wins) > 0 else 0,
            "largest_loss": float(np.min(losses)) if len(losses) > 0 else 0,
        }

    @staticmethod
    def profit_factor(trade_pnls: np.ndarray) -> float:
        """
        Profit Factor = Gross Profit / Gross Loss.

        PF > 1.0 means the strategy is profitable.
        PF > 1.5 is generally considered good.
        """
        gross_profit = float(np.sum(trade_pnls[trade_pnls > 0]))
        gross_loss = float(np.abs(np.sum(trade_pnls[trade_pnls < 0])))
        return gross_profit / gross_loss if gross_loss > 0 else float("inf")

    @classmethod
    def compute_all(
        cls,
        equity_curve: np.ndarray,
        trade_pnls: np.ndarray | None = None,
    ) -> dict:
        """
        Compute all performance metrics from an equity curve.
        """
        returns = np.diff(equity_curve) / equity_curve[:-1]

        metrics = {
            "total_return_pct": float((equity_curve[-1] / equity_curve[0] - 1) * 100),
            "annualized_return_pct": float(np.mean(returns) * 252 * 100),
            "annualized_volatility_pct": float(np.std(returns) * np.sqrt(252) * 100),
            "sharpe_ratio": cls.sharpe_ratio(returns),
            "sortino_ratio": cls.sortino_ratio(returns),
            "max_drawdown_pct": float(cls.max_drawdown(equity_curve) * 100),
            "calmar_ratio": cls.calmar_ratio(returns, equity_curve),
        }

        if trade_pnls is not None and len(trade_pnls) > 0:
            metrics["profit_factor"] = cls.profit_factor(trade_pnls)
            metrics["win_loss"] = cls.win_loss_ratio(trade_pnls)

        return metrics
```

---

## 3. Equity Curve & Drawdown Visualization

```python
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

def plot_equity_and_drawdown(
    equity_curve: np.ndarray,
    dates: pd.DatetimeIndex | None = None,
    title: str = "Backtest Results",
    save_path: str | None = None,
) -> None:
    """
    Generate a two-panel plot: equity curve and drawdown underwater chart.
    """
    if dates is None:
        dates = pd.date_range("2020-01-01", periods=len(equity_curve), freq="B")

    peak = np.maximum.accumulate(equity_curve)
    drawdown = (peak - equity_curve) / peak * 100  # As percentage

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 8), sharex=True,
                                     gridspec_kw={"height_ratios": [3, 1]})

    # Equity curve
    ax1.plot(dates, equity_curve, color="#2196F3", linewidth=1.5, label="Portfolio")
    ax1.fill_between(dates, equity_curve, alpha=0.1, color="#2196F3")
    ax1.set_ylabel("Portfolio Value (₹)")
    ax1.set_title(title)
    ax1.legend(loc="upper left")
    ax1.grid(True, alpha=0.3)

    # Drawdown underwater
    ax2.fill_between(dates, 0, -drawdown, color="#F44336", alpha=0.5)
    ax2.set_ylabel("Drawdown (%)")
    ax2.set_xlabel("Date")
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches="tight")
    plt.show()
```

---

## 4. QuantStats Integration

For comprehensive automated HTML reports:

```python
# Optional: install quantstats
# uv pip install quantstats

def generate_quantstats_report(
    returns: pd.Series,
    benchmark_returns: pd.Series | None = None,
    output_path: str = "backtest_report.html",
    title: str = "Trading Strategy Report",
) -> None:
    """
    Generate a full QuantStats HTML tearsheet.

    Args:
        returns: Strategy daily returns as pd.Series with DatetimeIndex.
        benchmark_returns: Optional benchmark returns (e.g., NIFTY 50).
        output_path: Path to save the HTML report.
        title: Report title.
    """
    import quantstats as qs

    qs.reports.html(
        returns,
        benchmark=benchmark_returns,
        output=output_path,
        title=title,
    )
```

---

## 5. Factor Attribution Logger

```python
class FactorAttributionLog:
    """
    Track which factors (technical, sentiment, RL policy) drove each trade.
    Useful for explainability and strategy refinement.
    """

    def __init__(self):
        self._log: list[dict] = []

    def record(
        self,
        trade_id: str,
        factors: dict[str, float],
        action: int,
        primary_trigger: str,
    ) -> None:
        """
        Record factor values at trade time.

        Args:
            trade_id: Unique trade identifier.
            factors: Dict of factor_name -> factor_value at decision time.
            action: Action taken (0-4).
            primary_trigger: Which factor was the primary driver.
        """
        self._log.append({
            "trade_id": trade_id,
            "factors": factors,
            "action": action,
            "primary_trigger": primary_trigger,
        })

    def to_dataframe(self) -> pd.DataFrame:
        """Convert log to DataFrame for analysis."""
        rows = []
        for entry in self._log:
            row = {"trade_id": entry["trade_id"], "action": entry["action"],
                   "primary_trigger": entry["primary_trigger"]}
            row.update(entry["factors"])
            rows.append(row)
        return pd.DataFrame(rows)

    def factor_importance(self) -> pd.Series:
        """Count how often each factor was the primary trigger."""
        df = self.to_dataframe()
        return df["primary_trigger"].value_counts(normalize=True)
```

---

## 6. Dependencies

```toml
numpy = ">=1.26"
pandas = ">=2.2"
matplotlib = ">=3.8"
pydantic = ">=2.7"
quantstats = ">=0.0.62"  # Optional, for HTML reports
```
