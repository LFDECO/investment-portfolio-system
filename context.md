# Project Context & Agent Handover Dossier
## Portfolio.Ai: Autonomous Event-Driven Quantitative Trading Simulation System

> **Purpose of this Document**:  
> This file preserves the end-to-end conversational, architectural, and operational context across all work performed to date. If a new agent window or human developer takes over, this document provides complete situational awareness: the project history, core architectural decisions, problems diagnosed and fixed, current implementation status, and immediate next steps.

---

## 1. Executive Summary & Project Mission

The goal of this project is to build an **autonomous, event-driven quantitative trading simulation and backtesting subsystem in Python for Indian Equities (National Stock Exchange - NSE)**, designed to operate alongside the existing **Portfolio.Ai** investment management web platform.

### Core Architecture at a Glance
1. **Data Ingestion**: Multi-asset OHLCV price bars fetched via free APIs (`yfinance` + NSE endpoints).
2. **Alternative Data**: Live financial news and social media chatter scraped from free Indian feeds (Moneycontrol, Economic Times, LiveMint, Reddit `r/IndianStreetBets`).
3. **NLP Sentiment Engine**: Natural Language Processing using HuggingFace's `ProsusAI/finbert` on English financial text to compute sentiment vectors and dynamic 3x rolling $z$-score watchlist triggers.
4. **Market Microstructure & Simulation**: Custom Farama Gymnasium `TradingEnv` featuring dynamic bid-ask spreads, volume-based non-linear slippage, NSE statutory circuit limits (5%, 10%, 20%), and intraday square-off logic.
5. **Zero Look-Ahead Bias**: Strict point-in-time causal ordering ($t_0 \le t$) where news at timestamp $t$ can only trigger orders executed at candle open $t+1$.
6. **Strategy Agents**: Baseline heuristic strategies (Momentum + VWAP breakout, Mean Reversion) and Reinforcement Learning agents (Stable-Baselines3 PPO/RecurrentPPO).
7. **Institutional Validation**: Purged Walk-Forward Cross-Validation (PWFCV) with purge gaps and embargo periods across Indian market regimes (NIFTY 50 / India VIX).
8. **Telemetry & Reporting**: Granular per-trade JSON telemetry logging every trigger and technical indicator value, with automated QuantStats HTML tear-sheets.

---

## 2. Core Architectural Decisions & User Constraints

Through interactive alignment with the user, the following key engineering constraints were established:
- **100% Free Data**: Zero reliance on paid brokerage APIs (e.g. Zerodha Kite Connect). All data is ingested from free public sources (`yfinance`, NSE archives, public RSS, public Reddit JSON).
- **Package & Runtime Tooling**: Use **`uv`** (Rust-based package manager) for sub-minute dependency installation, deterministic lockfiles, and automatic provisioning of CPython 3.11.
- **Language Scope for NLP**: Strictly **English** financial text for the FinBERT sentiment pipeline.
- **Trading Style**: **Square-Off Equity Model**. The agent simulates trading liquid Indian equities with the dynamic choice to either square off positions before market close (15:15 IST) or hold overnight.
- **Friction & Taxes**: Configurable zero-tax / zero-brokerage toggle for pure alpha simulations, alongside an Indian statutory fee model (STT, GST, SEBI turnover, stamp duty) for realistic friction auditing.
- **Database & Cloud Deployment**: The platform currently runs on local MySQL (`portfolio_management`), with schemas and data backed up to `db_schema_current.sql` and `db_data_current.sql`. Future roadmap includes migrating to TiDB Serverless or Railway MySQL so the Python simulation agent can run 24/7 autonomously in the cloud.

---

## 3. Web Platform Bugs Diagnosed & Fixed

During earlier phases, multiple issues on the Portfolio.Ai web application were investigated and resolved:

### A. Static Market Status Banner
- **Problem**: The UI displayed a hardcoded, static text: `"Previous Days Data"`.
- **Fix**: Added `getIndianMarketStatus()` in [schemaApi.ts](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/server/_core/schemaApi.ts) and exposed `/api/v1/market/status`. Updated [BuySell.tsx](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/client/src/pages/BuySell.tsx) with a dynamic badge (`NSE LIVE` in green during 09:15–15:30 IST weekdays; `Market Closed` in amber outside market hours with last session close time).

### B. Alphabetical Sorting in Top Gainers / Losers
- **Problem**: Market summary tabs only queried the top ~20 alphabetical tickers (`A*` stocks like ABB, Adani), failing to surface true market gainers and losers.
- **Fix**: Curated `NIFTY_LIQUID_UNIVERSE` spanning ~80 highly liquid Indian equities across all sectors and letters, with client and server sorting by mathematical `change_percent`.

### C. TradingView-Grade Interactive Candlestick Chart
- **Problem**: Asset detail pages lacked interactive financial charting.
- **Fix**: Installed `lightweight-charts` via `pnpm`, created [CandlestickChart.tsx](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/client/src/components/CandlestickChart.tsx), and integrated it into [BuySellDetails.tsx](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/client/src/pages/BuySellDetails.tsx) with timeframe toggles (`1D (5m)`, `1W (15m)`, `1M (1d)`, `3M`, `1Y`), volume histogram, and dynamic hover legends.

### D. Stale Market Quotes (The Power Grid & ONGC Bug)
- **Problem**: The user noted that market prices were stale:
  - `POWERGRID.NS` showed ₹271.75 (+2.22%) in the app; actual price was **₹269.10 (-0.98%)**.
  - `ONGC.NS` showed ₹237.27 (+1.39%) in the app; actual price was **₹232.50 (-2.01%)**.
- **Root Cause**:
  1. Yahoo Finance deprecated and returns `401 Unauthorized` for unauthenticated batch quote requests (`/v7/finance/quote`).
  2. `fetchLiveQuoteSnapshots` caught the error and returned an empty Map.
  3. The fallback `enrichMissingQuotesWithHistory` queried daily historical bars, but for the current day's active session, Yahoo sets the candle `close` field as `null` (storing the active price in `meta.regularMarketPrice`).
  4. The candle parser discarded `null` rows, causing the system to treat **yesterday's close** (Sept 10: ₹271.75 / ₹237.27) as "today's price", and day-before-yesterday's close as "previous close", showing outdated gains instead of losses.
- **Resolution**:
  1. Migrated the quote engine to `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d` with a 16-worker concurrency pool and 20-second in-memory quote cache (`quoteCache`). All 80 liquid stocks now load in $< 1$ second.
  2. Reconciled unfinalized daily candles in `fetchHistoricalPrices` using `meta.regularMarketPrice`.
  3. Updated corporate tickers: `REC.NS` $\rightarrow$ `RECLTD.NS`, `ZOMATO.NS` $\rightarrow$ `ETERNAL.NS`, `TATAMOTORS.NS` $\rightarrow$ `TMPV.NS`.
  4. Verified with live API queries: `POWERGRID.NS` = ₹269.10 (-0.98%), `ONGC.NS` = ₹232.50 (-2.01%), accurately ranked in Top 5 Losers.

### E. Node Server Process Cleanup
- Terminated dev server background task `task-641` on user request, completely freeing port `3000`.

---

## 4. Skills Created in `.agents/skills/`

A suite of 10 specialized agent skills was authored to govern every aspect of the quant subsystem:

1. [`python-project-bootstrap`](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/.agents/skills/python-project-bootstrap/SKILL.md): Python 3.11 setup, `uv`, pyproject.toml, strict mypy/ruff, Pydantic v2 schemas.
2. [`indian-market-data-ingestion`](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/.agents/skills/indian-market-data-ingestion/SKILL.md): Price data OHLCV ingestion via free APIs (yfinance, nsetools), IST alignment, ticker mapping.
3. [`news-social-scraping-india`](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/.agents/skills/news-social-scraping-india/SKILL.md): Scrape Indian financial news (Moneycontrol, ET, LiveMint) & Reddit `r/IndianStreetBets`, velocity tracking, 3x rolling z-score trigger.
4. [`finbert-sentiment-engine`](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/.agents/skills/finbert-sentiment-engine/SKILL.md): ProsusAI/finbert inference for English financial text, NER ticker mapping, sentiment vectors.
5. [`technical-indicators-pipeline`](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/.agents/skills/technical-indicators-pipeline/SKILL.md): Vectorized point-in-time technical analysis indicators (RSI, VWAP, Bollinger Bands, MACD, ATR, OBV).
6. [`look-ahead-bias-prevention`](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/.agents/skills/look-ahead-bias-prevention/SKILL.md): Strict point-in-time data integrity ($t_0 \le t$), aligning news events to subsequent candle open, rolling window auditing.
7. [`gymnasium-trading-env`](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/.agents/skills/gymnasium-trading-env/SKILL.md): Custom Farama Gymnasium trading simulation environment, Indian fee/slippage models, circuit limits, EOD square-off.
8. [`trading-strategy-agents`](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/.agents/skills/trading-strategy-agents/SKILL.md): Baseline heuristic & ML trading strategies (momentum, mean-reversion, sentiment-threshold, Stable-Baselines3 RL agent).
9. [`trade-telemetry-analytics`](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/.agents/skills/trade-telemetry-analytics/SKILL.md): Per-trade JSON telemetry logging, sentiment/technical trigger capture, performance metrics (Sharpe, Sortino, Max Drawdown), QuantStats HTML reports.
10. [`backtest-walk-forward-validation`](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/.agents/skills/backtest-walk-forward-validation/SKILL.md): Purged Walk-Forward Cross-Validation, Indian market regimes (bull/bear/high-vol via NIFTY 50), train/test purge gaps, combinatorial purged CV (CPCV), Monte Carlo permutation testing.

---

## 5. Master Documentation Artifacts

- **[plan.md](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/plan.md)**: Master engineering roadmap detailing Phases 0 through 9, mapping deliverables, technical rules, and skill relationships.
- **[learnings.md](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/learnings.md)**: Educational handbook providing beginner-friendly conceptual overviews, deep technical mechanics, architectural rationales, and glossaries for Phase 0 and Phase 1.
- **[walkthrough.md](file:///C:/Users/91801/.gemini/antigravity-ide/brain/e9febcdf-904c-4daf-a84b-1a17ea84856f/walkthrough.md)**: Audit log of tested changes and verification results.

---

## 6. Implementation Progress: Phase 0 Completed

**Phase 0: Subsystem Architecture & Python Bootstrap** is 100% complete and verified:

1. **`uv` Package Manager**:
   - Installed `uv 0.12.13`.
   - Pinned Python to `3.11` via [.python-version](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/.python-version).
   - Provisioned CPython 3.11.16 in `.venv`.
   - Configured [pyproject.toml](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/pyproject.toml) with 76 locked dependencies (`pydantic`, `pandas`, `numpy`, `scipy`, `yfinance`, `transformers`, `torch`, `gymnasium`, `stable-baselines3`, `quantstats`, `mypy`, `ruff`, `pytest`).

2. **Package Hierarchy Skeleton**:
   - Initialized `src/`:
     - `src/data/`: Data ingestion and schemas
     - `src/nlp/`: FinBERT sentiment engine
     - `src/env/`: Farama Gymnasium environment
     - `src/strategy/`: Baseline heuristic & RL strategy agents
     - `src/indicators/`: Point-in-time technical analysis indicators
     - `src/backtest/`: Purged walk-forward cross-validation
     - `src/analytics/`: Trade telemetry and QuantStats reports
     - `src/bridge/`: Portfolio.Ai platform integration

3. **Strict Pydantic v2 Domain Schemas ([schemas.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/src/data/schemas.py))**:
   - `StrictSchema`: Base class with `strict=True`, `frozen=True`, `extra="forbid"`.
   - Transfer objects: `PriceBar`, `NewsArticle`, `SentimentScore`, `SentimentFeatureVector`, `Order`, `Trade`, `Position`, `PortfolioState`.

4. **Pipeline CLI & Verification**:
   - Built [main.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/main.py) CLI entry point.
   - Updated [.gitignore](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/.gitignore).
   - `uv run pytest`: **3 passed in 0.20s** ([test_phase0_schemas.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/tests/test_phase0_schemas.py)).
   - `uv run mypy src/`: **Success: no issues found in 10 source files** (strict mode).
   - `uv run ruff check src/ tests/`: **All checks passed!**

---

## 7. Immediate Next Task: Phase 1 Implementation Plan

The next phase to execute is **Phase 1: Free Market Data Ingestion & Time-Series Alignment**.

### Scope of Phase 1:
1. **`src/data/price_fetcher.py`**:
   - Build a robust price fetcher using `yfinance` with fallback to direct NSE endpoints.
   - Support historical daily bars (`1d`) and intraday bars (`5m`, `15m`).
   - Standardize tickers to NSE format (`.NS`).
2. **NSE Trading Calendar & IST Timezone Normalization**:
   - Handle Indian Standard Time (IST, UTC+5:30) explicitly.
   - Regular trading session boundaries: 09:15 to 15:30 IST.
   - Calendar filter excluding weekends and official NSE trading holidays without interpolating false data.
3. **`src/data/data_queue.py` (Chronological Event Queue)**:
   - Implement priority queue ordering market events strictly by timestamp ($t_0 \le t_1 \le t_2$).
   - Prevent any time-travel or future data leakage.
4. **Automated Look-Ahead Assertions**:
   - Write tests in `tests/test_phase1_data.py` asserting that appending future bars never mutates historical observations.
