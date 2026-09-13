---
name: python-project-bootstrap
description: >-
  Bootstrap the Python quantitative trading subsystem within the existing
  TypeScript investment-portfolio-system project. Use this skill when
  setting up the Python project structure (src/data, src/nlp, src/env,
  src/strategy, src/analytics, main.py), configuring pyproject.toml with
  uv for dependency management, defining Pydantic v2 data schemas, setting
  up mypy for strict typing, or establishing integration touchpoints between
  the Python subsystem and the existing TypeScript/tRPC backend.
---

# Python Project Bootstrap

This skill covers setting up the Python quantitative trading subsystem
inside the existing TypeScript project, using `uv` for dependency
management and Pydantic v2 for data validation.

---

## 1. Directory Layout

The Python subsystem lives alongside the existing TypeScript project:

```
investment-portfolio-system/           # Existing project root
├── client/                            # Existing React frontend
├── server/                            # Existing Express/tRPC backend
├── shared/                            # Existing shared types
├── drizzle/                           # Existing DB schema
├── package.json                       # Existing Node.js config
│
├── src/                               # NEW: Python subsystem root
│   ├── __init__.py
│   ├── data/                          # Subsystem A: Data ingestion
│   │   ├── __init__.py
│   │   ├── price_fetcher.py           # yfinance OHLCV fetcher
│   │   ├── news_scraper.py            # RSS & Reddit scraper
│   │   ├── entity_mapper.py           # NER alias → ticker mapper
│   │   ├── data_queue.py              # Async temporal alignment queue
│   │   └── schemas.py                 # Pydantic data models
│   ├── nlp/                           # Subsystem B: Sentiment engine
│   │   ├── __init__.py
│   │   ├── finbert_pipeline.py        # FinBERT inference
│   │   ├── sentiment_features.py      # Feature vector assembly
│   │   └── schemas.py                 # Sentiment Pydantic models
│   ├── env/                           # Subsystem C: Gymnasium environment
│   │   ├── __init__.py
│   │   ├── trading_env.py             # Custom Gymnasium Env
│   │   ├── fee_model.py               # Indian brokerage fee calculator
│   │   ├── slippage_model.py          # Market impact / slippage
│   │   └── schemas.py                 # Env-related Pydantic models
│   ├── strategy/                      # Strategy agents
│   │   ├── __init__.py
│   │   ├── base.py                    # Abstract BaseStrategy
│   │   ├── momentum.py                # Momentum strategy
│   │   ├── mean_reversion.py          # Mean reversion strategy
│   │   ├── sentiment.py               # Sentiment-driven strategy
│   │   └── rl_agent.py                # RL wrapper (SB3)
│   ├── analytics/                     # Subsystem D: Telemetry & reporting
│   │   ├── __init__.py
│   │   ├── metrics.py                 # Sharpe, Sortino, MDD, etc.
│   │   ├── telemetry.py               # Trade logger
│   │   ├── attribution.py             # Factor importance
│   │   └── reporting.py               # QuantStats / matplotlib reports
│   ├── indicators/                    # Technical indicators
│   │   ├── __init__.py
│   │   ├── technical.py               # RSI, MACD, BB, etc.
│   │   └── normalizer.py              # Feature normalization
│   └── backtest/                      # Backtesting framework
│       ├── __init__.py
│       ├── walk_forward.py            # Purged Walk-Forward CV
│       ├── regime.py                  # Market regime detection
│       └── runner.py                  # Backtest orchestration
│
├── main.py                            # NEW: End-to-end pipeline entry point
├── pyproject.toml                     # NEW: Python project config (uv)
└── .python-version                    # NEW: Python version pin
```

---

## 2. pyproject.toml Template

```toml
[project]
name = "quant-trading-sim"
version = "0.1.0"
description = "Event-driven quantitative trading simulation for Indian equities"
readme = "README.md"
requires-python = ">=3.11"
license = { text = "MIT" }

dependencies = [
    # Data ingestion
    "yfinance>=0.2.40",
    "nsetools>=1.0.12",
    "feedparser>=6.0",
    "praw>=7.7",
    "httpx>=0.27",

    # NLP
    "transformers>=4.40",
    "torch>=2.2",

    # Trading environment
    "gymnasium>=0.29",

    # Core
    "pydantic>=2.7",
    "numpy>=1.26",
    "pandas>=2.2",

    # Analytics & visualization
    "matplotlib>=3.8",
    "quantstats>=0.0.62",

    # Strategy (optional RL)
    "stable-baselines3>=2.3",
]

[project.optional-dependencies]
dev = [
    "mypy>=1.10",
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "ruff>=0.4",
]

[tool.mypy]
python_version = "3.11"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_incomplete_defs = true
check_untyped_defs = true
plugins = ["pydantic.mypy"]

[tool.mypy.pydantic-mypy]
init_forbid_extra = true
init_typed = true
warn_required_dynamic_aliases = true

[tool.ruff]
target-version = "py311"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP", "B", "A", "SIM", "TCH"]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
```

---

## 3. Project Initialization Commands

```bash
# 1. Ensure uv is installed
# On Windows:
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# 2. Pin Python version
echo "3.11" > .python-version

# 3. Initialize uv project (from project root)
uv init --no-readme

# 4. Install dependencies
uv sync

# 5. Verify installation
uv run python -c "import yfinance; import torch; import gymnasium; print('All imports OK')"
```

---

## 4. Pydantic v2 Conventions

All data transfer objects across the subsystem use Pydantic v2 with strict mode:

```python
from pydantic import BaseModel, Field, ConfigDict

class StrictSchema(BaseModel):
    """Base class for all project schemas."""
    model_config = ConfigDict(
        strict=True,          # No implicit type coercion
        frozen=True,          # Immutable after creation
        extra="forbid",       # No extra fields allowed
        validate_default=True,
    )

# Example usage:
class TradeOrder(StrictSchema):
    ticker: str = Field(..., min_length=1, max_length=20)
    side: str = Field(..., pattern=r"^(BUY|SELL)$")
    quantity: int = Field(..., gt=0)
    limit_price: float = Field(..., gt=0)
```

---

## 5. Module Interface Contracts

Each subsystem exposes a clean public API through its `__init__.py`:

```python
# src/data/__init__.py
from .price_fetcher import PriceFetcher
from .news_scraper import NewsScraper
from .entity_mapper import EntityMapper
from .data_queue import DataAlignmentQueue
from .schemas import OHLCVBar, CorporateAction

__all__ = [
    "PriceFetcher", "NewsScraper", "EntityMapper",
    "DataAlignmentQueue", "OHLCVBar", "CorporateAction",
]
```

---

## 6. Integration with TypeScript Backend

The Python subsystem can integrate with the existing TypeScript backend via:

### Option A: Shared MySQL Database
Both systems read/write to the same MySQL database. Python uses SQLAlchemy
or direct mysql-connector-python with the same `DATABASE_URL`.

```python
import os
from sqlalchemy import create_engine

DATABASE_URL = os.environ.get("DATABASE_URL", "mysql://root:deco@localhost:3306/portfolio_management")
engine = create_engine(DATABASE_URL.replace("mysql://", "mysql+pymysql://"))
```

### Option B: REST API Bridge
Python calls the tRPC endpoints via HTTP, or the TypeScript backend
calls Python scripts via child_process.

### Option C: File-Based Exchange (Recommended for Simulation)
Simulation results are written to JSON/Parquet files that the TypeScript
dashboard reads for visualization. This keeps the systems decoupled.

```python
# Write simulation results for the dashboard
import json
from pathlib import Path

RESULTS_DIR = Path("simulation_results")
RESULTS_DIR.mkdir(exist_ok=True)

def export_backtest_results(results: dict, filename: str = "latest_backtest.json"):
    with open(RESULTS_DIR / filename, "w") as f:
        json.dump(results, f, indent=2, default=str)
```

---

## 7. main.py Entry Point Template

```python
#!/usr/bin/env python3
"""
End-to-end pipeline orchestration for quantitative trading simulation.

Usage:
    uv run python main.py --ticker RELIANCE.NS --start 2022-01-01 --end 2024-01-01
"""
import argparse
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description="Quant Trading Simulation")
    parser.add_argument("--ticker", type=str, default="RELIANCE.NS")
    parser.add_argument("--start", type=str, default="2022-01-01")
    parser.add_argument("--end", type=str, default="2024-01-01")
    parser.add_argument("--initial-cash", type=float, default=1_000_000)
    parser.add_argument("--strategy", type=str, default="momentum",
                        choices=["momentum", "mean_reversion", "sentiment", "rl"])
    args = parser.parse_args()

    logger.info(f"Starting backtest: {args.ticker} [{args.start} → {args.end}]")
    logger.info(f"Strategy: {args.strategy}, Initial cash: ₹{args.initial_cash:,.0f}")

    # Step 1: Fetch price data
    # from src.data import PriceFetcher
    # fetcher = PriceFetcher()
    # bars = fetcher.fetch(args.ticker, args.start, args.end)

    # Step 2: Compute technical indicators
    # from src.indicators import TechnicalIndicators
    # features = TechnicalIndicators.compute_all(price_df)

    # Step 3: (Optional) Fetch news and compute sentiment
    # from src.nlp import FinBERTSentimentAnalyzer
    # analyzer = FinBERTSentimentAnalyzer()
    # ...

    # Step 4: Create environment
    # from src.env import TradingEnv
    # env = TradingEnv(price_data, feature_data, initial_cash=args.initial_cash)

    # Step 5: Run backtest
    # from src.backtest import BacktestRunner, PurgedWalkForwardCV
    # cv = PurgedWalkForwardCV(n_splits=5)
    # runner = BacktestRunner(env_factory, strategy_factory)
    # results = runner.run(price_data, feature_data, cv.split(len(price_data)))

    # Step 6: Compute metrics and generate report
    # from src.analytics import PerformanceMetrics
    # metrics = PerformanceMetrics.compute_all(equity_curve, trade_pnls)

    logger.info("Pipeline complete.")

if __name__ == "__main__":
    main()
```

---

## 8. .gitignore Additions

```gitignore
# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
.python-version

# uv
.uv/

# Model artifacts
*.pt
*.bin
*.safetensors

# Simulation outputs
simulation_results/
*.jsonl
backtest_report.html
```
