---
name: backtest-walk-forward-validation
description: >-
  Implement rigorous backtesting with Purged Walk-Forward Cross-Validation
  to prevent overfitting. Use this skill when designing backtest pipelines,
  detecting Indian market regimes (bull/bear/high-vol using NIFTY 50/SENSEX),
  implementing train/test purge gaps, running combinatorial purged
  cross-validation (CPCV), or performing statistical significance testing
  (bootstrap, Monte Carlo permutation) on strategy returns.
---

# Backtest & Walk-Forward Validation

This skill covers building a rigorous backtesting framework that prevents
overfitting through Purged Walk-Forward Cross-Validation across distinct
Indian market regimes.

---

## 1. Why Purged Walk-Forward?

Standard k-fold CV on time series is **invalid** — it leaks future data
into training. Walk-Forward CV respects temporal ordering, and the **purge
gap** eliminates samples where features from the training set could contain
information from the test set (due to rolling windows).

```
Traditional k-fold (WRONG for time series):
  Fold 1: [TEST] [TRAIN] [TRAIN] [TRAIN]
  Fold 2: [TRAIN] [TEST] [TRAIN] [TRAIN]
  ↑ Future data leaks into training!

Purged Walk-Forward (CORRECT):
  Split 1: [===TRAIN===] [PURGE] [==TEST==]
  Split 2: [======TRAIN======] [PURGE] [==TEST==]
  Split 3: [=========TRAIN=========] [PURGE] [==TEST==]
  ↑ Always train on past, test on future, with a gap
```

---

## 2. Indian Market Regime Detection

Classify historical periods into regimes using NIFTY 50 as the benchmark.

```python
import pandas as pd
import numpy as np
from enum import Enum

class MarketRegime(str, Enum):
    BULL = "bull"
    BEAR = "bear"
    HIGH_VOL = "high_volatility"
    SIDEWAYS = "sideways"

def classify_regime(
    index_returns: pd.Series,
    window: int = 63,  # ~3 months of trading days
    vol_window: int = 21,  # ~1 month
    bull_threshold: float = 0.15,   # 15% annualized return
    bear_threshold: float = -0.10,  # -10% annualized return
    vol_threshold: float = 0.25,    # 25% annualized vol
) -> pd.Series:
    """
    Classify each trading day into a market regime.

    Uses rolling return and volatility of NIFTY 50 / SENSEX.

    Args:
        index_returns: Daily returns of the benchmark index.
        window: Lookback for rolling return calculation.
        vol_window: Lookback for rolling volatility.

    Returns:
        Series of MarketRegime labels aligned to the input index.
    """
    # Annualized rolling return
    rolling_return = index_returns.rolling(window).sum() * (252 / window)

    # Annualized rolling volatility
    rolling_vol = index_returns.rolling(vol_window).std() * np.sqrt(252)

    regimes = pd.Series(MarketRegime.SIDEWAYS, index=index_returns.index)

    regimes[rolling_vol > vol_threshold] = MarketRegime.HIGH_VOL
    regimes[(rolling_return > bull_threshold) & (rolling_vol <= vol_threshold)] = MarketRegime.BULL
    regimes[(rolling_return < bear_threshold) & (rolling_vol <= vol_threshold)] = MarketRegime.BEAR

    return regimes
```

---

## 3. Purged Walk-Forward Cross-Validation

```python
from dataclasses import dataclass

@dataclass
class WalkForwardSplit:
    """A single train/test split with purge gap."""
    train_start: int
    train_end: int
    purge_end: int  # purge_end = train_end + purge_gap
    test_start: int  # test_start = purge_end
    test_end: int
    regime_label: str  # Dominant regime in test set

class PurgedWalkForwardCV:
    """
    Purged Walk-Forward Cross-Validation for time series.

    Generates non-overlapping train/test splits where:
    - Training always precedes testing
    - A purge gap separates them to prevent feature leakage
    - Each test set falls into a classified market regime
    """

    def __init__(
        self,
        n_splits: int = 5,
        purge_gap: int = 10,         # Trading days between train and test
        min_train_size: int = 252,   # ~1 year minimum training
        test_size: int = 63,         # ~3 months per test window
        expanding: bool = True,      # Expanding window (vs. sliding)
    ):
        self.n_splits = n_splits
        self.purge_gap = purge_gap
        self.min_train_size = min_train_size
        self.test_size = test_size
        self.expanding = expanding

    def split(
        self,
        n_samples: int,
        regimes: pd.Series | None = None,
    ) -> list[WalkForwardSplit]:
        """
        Generate walk-forward splits.

        Args:
            n_samples: Total number of time steps in the dataset.
            regimes: Optional regime classification for each time step.

        Returns:
            List of WalkForwardSplit objects.
        """
        splits = []

        # Calculate test windows from the end
        total_test = self.n_splits * self.test_size
        total_purge = self.n_splits * self.purge_gap
        available = n_samples - self.min_train_size - total_test - total_purge

        if available < 0:
            raise ValueError(
                f"Dataset too small for {self.n_splits} splits. "
                f"Need at least {self.min_train_size + total_test + total_purge} samples, "
                f"got {n_samples}."
            )

        step = available // self.n_splits if not self.expanding else 0

        for i in range(self.n_splits):
            if self.expanding:
                train_start = 0
                train_end = self.min_train_size + i * (self.test_size + self.purge_gap)
            else:
                train_start = i * step
                train_end = train_start + self.min_train_size + i * (self.test_size + self.purge_gap)

            purge_end = train_end + self.purge_gap
            test_start = purge_end
            test_end = test_start + self.test_size

            if test_end > n_samples:
                break

            # Determine dominant regime in test window
            regime_label = "unknown"
            if regimes is not None:
                test_regimes = regimes.iloc[test_start:test_end]
                regime_label = test_regimes.mode().iloc[0] if len(test_regimes) > 0 else "unknown"

            splits.append(WalkForwardSplit(
                train_start=train_start,
                train_end=train_end,
                purge_end=purge_end,
                test_start=test_start,
                test_end=test_end,
                regime_label=str(regime_label),
            ))

        return splits
```

---

## 4. Backtest Runner

```python
class BacktestRunner:
    """
    Runs a strategy across multiple walk-forward splits and aggregates results.
    """

    def __init__(self, env_factory, strategy_factory):
        """
        Args:
            env_factory: Callable(price_data, feature_data) -> TradingEnv
            strategy_factory: Callable() -> BaseStrategy
        """
        self.env_factory = env_factory
        self.strategy_factory = strategy_factory

    def run(
        self,
        price_data: np.ndarray,
        feature_data: np.ndarray,
        splits: list[WalkForwardSplit],
    ) -> list[dict]:
        """
        Execute backtest across all walk-forward splits.

        Returns:
            List of result dicts per split, each containing:
            - split_info: WalkForwardSplit metadata
            - portfolio_values: list of portfolio values per step
            - trade_log: list of trade records
            - metrics: performance metrics dict
        """
        results = []

        for split in splits:
            # Extract test window data
            test_prices = price_data[split.test_start:split.test_end]
            test_features = feature_data[split.test_start:split.test_end]

            # Create environment and strategy
            env = self.env_factory(test_prices, test_features)
            strategy = self.strategy_factory()

            # Run episode
            obs, info = env.reset()
            strategy.reset()
            portfolio_values = [info["portfolio_value"]]
            done = False

            while not done:
                action = strategy.act(obs, info)
                obs, reward, terminated, truncated, info = env.step(action)
                portfolio_values.append(info["portfolio_value"])
                done = terminated or truncated

            results.append({
                "split_info": split,
                "portfolio_values": portfolio_values,
                "trade_log": env._trade_log,
                "regime": split.regime_label,
            })

        return results
```

---

## 5. Statistical Significance Testing

```python
def bootstrap_sharpe_test(
    strategy_returns: np.ndarray,
    benchmark_returns: np.ndarray,
    n_bootstrap: int = 10000,
    confidence: float = 0.95,
) -> dict:
    """
    Bootstrap test for whether strategy Sharpe exceeds benchmark Sharpe.

    Returns:
        dict with p_value, strategy_sharpe, benchmark_sharpe,
        confidence_interval.
    """
    def sharpe(returns):
        if np.std(returns) == 0:
            return 0.0
        return np.mean(returns) / np.std(returns) * np.sqrt(252)

    observed_diff = sharpe(strategy_returns) - sharpe(benchmark_returns)

    # Pool returns under null hypothesis
    pooled = np.concatenate([strategy_returns, benchmark_returns])
    n = len(strategy_returns)

    bootstrap_diffs = []
    for _ in range(n_bootstrap):
        perm = np.random.permutation(pooled)
        boot_strat = perm[:n]
        boot_bench = perm[n:]
        bootstrap_diffs.append(sharpe(boot_strat) - sharpe(boot_bench))

    bootstrap_diffs = np.array(bootstrap_diffs)
    p_value = float(np.mean(bootstrap_diffs >= observed_diff))

    ci_lower = float(np.percentile(bootstrap_diffs, (1 - confidence) / 2 * 100))
    ci_upper = float(np.percentile(bootstrap_diffs, (1 + confidence) / 2 * 100))

    return {
        "strategy_sharpe": float(sharpe(strategy_returns)),
        "benchmark_sharpe": float(sharpe(benchmark_returns)),
        "sharpe_diff": float(observed_diff),
        "p_value": p_value,
        "significant": p_value < (1 - confidence),
        "confidence_interval": (ci_lower, ci_upper),
    }
```

---

## 6. Key Indian Market Regime Periods (Reference)

| Period | Regime | NIFTY Behaviour |
|---|---|---|
| 2003–2007 | Bull | Tech-led rally, FII inflows |
| 2008 (Jan–Oct) | Bear | GFC crash, NIFTY -60% |
| 2009–2010 | Bull | Recovery rally |
| 2011–2013 | Sideways | Range-bound, policy paralysis |
| 2014–2017 | Bull | Modi rally, Make in India |
| 2018 (Sep–Oct) | High Vol | IL&FS crisis, NBFC stress |
| 2020 (Feb–Mar) | Bear | COVID crash, NIFTY -38% |
| 2020 (Apr)–2021 | Bull | Liquidity-driven rally |
| 2022 | High Vol | Russia-Ukraine, rate hikes |
| 2023–2024 | Bull | Domestic flows, Capex cycle |

---

## 7. Dependencies

```toml
pandas = ">=2.2"
numpy = ">=1.26"
```
