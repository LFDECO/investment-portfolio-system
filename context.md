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

## 7. Implementation Progress: Phase 1 Completed & Hardened

**Phase 1: Free Market Data & Temporal Synchronization Engine** is 100% complete, hardened, and verified:

1. **NSE Trading Calendar & Horizon Boundary Guard ([src/data/calendar.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/src/data/calendar.py))**:
   - Explicit timezone handling: `IST = zoneinfo.ZoneInfo("Asia/Kolkata")` and `UTC = zoneinfo.ZoneInfo("UTC")`.
   - Strict session boundaries:
     - Pre-open: 09:00 to 09:15 IST
     - Regular market hours: 09:15 to 15:30 IST
     - Intraday square-off cutoff: 15:15 IST
   - Comprehensive NSE holiday database covering 2023 through 2026.
   - **Horizon Boundary Hard Raise**: Enforces `MIN_COVERED_YEAR = 2023` and `MAX_COVERED_YEAR = 2026`. Any query outside this verified window fails loudly with a hard `ValueError` raise in `is_trading_day()`, preventing silent CI test misbehavior or unverified holiday assumptions.

2. **Columnar Parquet Cache & Multi-Asset Price Ingestion ([src/data/price_fetcher.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/src/data/price_fetcher.py))**:
   - Ticker normalizer automatically qualifying Indian equities (`POWERGRID` $\rightarrow$ `POWERGRID.NS`), preserving explicit `.BO` suffixes, and applying corporate symbol renames (`REC` $\rightarrow$ `RECLTD`, `ZOMATO` $\rightarrow$ `ETERNAL`, `TATAMOTORS` $\rightarrow$ `TMPV`).
   - Free data ingestion via `yfinance` with automated direct HTTP fallback to Yahoo Finance chart v8 API (`https://query1.finance.yahoo.com/v8/finance/chart/{ticker}`).
   - Deterministic synthetic bar generator (`generate_mock_bars`) for reproducible offline testing.
   - Candlestick mathematical sanity validator (`validate_candlestick`): asserts positive prices, $\text{high} \ge \max(\text{open}, \text{close})$, $\text{low} \le \min(\text{open}, \text{close})$, and $\text{volume} \ge 0$.
   - **Local Columnar Parquet Cache (`pyarrow`)**:
     - Partitioned by ticker and interval under `.cache/market_data/{ticker}_{interval}.parquet`.
     - **Strict Invalidation Policy**: Historical closed bars ($< \text{today}$) are completely immutable and never re-fetched from network once cached; only the current/active trading day is queried live.
   - **Price Discontinuity & Split Auditor (`detect_price_discontinuities`)**:
     - Audits day-over-day price continuity against NSE statutory circuit thresholds (20%).
     - Flags unflagged price shifts as `UNEXPLAINED_CIRCUIT_DISCONTINUITY` while reconciling explained splits against known corporate actions.

3. **Fast Vectorized Buffer for Gymnasium Hot-Loop ([src/data/fast_buffer.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/src/data/fast_buffer.py))**:
   - **Structural Boundary**: Pydantic validates once at serialization/ingestion boundary; subsequent simulation steps in Farama Gymnasium and RL agent observations interact strictly with contiguous C-ordered NumPy arrays (`matrix: np.ndarray (N, 5)` of `[open, high, low, close, volume]`).
   - `FastBarTuple` named tuple provides zero-overhead $O(1)$ single-bar access; `get_window()` provides zero-copy observation slices with edge-padding.

4. **Chronological Event Bus, Corporate Actions & Look-Ahead Prevention ([src/data/data_queue.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/src/data/data_queue.py))**:
   - `DataAlignmentQueue`: Priority queue ordered chronologically ($t_0 \le t_1 \le t_2$) with deterministic tie-breaking.
   - **FIFO Stability via Monotonic `sequence_id`**: Internal atomic counter (`itertools.count()`) assigned at insertion time as tertiary sort key `(timestamp, priority, sequence_id, payload)`, guaranteeing 100% deterministic replayability.
   - **Event Priority Ranking**: `0: CorporateAction`, `1: NewsArticle`, `2: PriceBar`.
   - **Physical Latency Look-Ahead Invariant**:
     - News with `published_at < bar.timestamp` is released at candle open.
     - News with `published_at >= bar.timestamp` (including exact timestamp matches) is explicitly held in `_pending_news` and released at candle $t+1$, mathematically modeling network, parsing, and order gateway transmission latency.
   - **Explicit Corporate Actions**:
     - `CorporateAction` domain schema (`SPLIT`, `BONUS`, `DIVIDEND`) flows through the priority queue on `ex_date` to dynamically scale portfolio holdings and cost basis without silently rewriting historical indicators.

5. **Package Exports & CLI Orchestration**:
   - Exported all calendar, fetcher, fast buffer, and queue interfaces in [src/data/__init__.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/src/data/__init__.py).
   - Updated [main.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/main.py) with `--fetch-mode` (`live`, `mock`), calendar inspection, and live queue alignment demonstration.

6. **Automated Verification Suite ([tests/test_phase1_data.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/tests/test_phase1_data.py))**:
   - `uv run pytest tests/ -v`: **19 passed in 1.35s** (covering ticker normalization, NSE calendar, session boundaries, candlestick validation, priority queue ordering, news release invariants, rolling truncation invariance, exact timestamp latency invariant, monotonic sequence_id FIFO tie-breaking, calendar horizon hard raise, FastBarBuffer contiguous indexing, Parquet disk cache roundtrips, and corporate action split detection).

7. **Out-of-the-Box Adversarial Stress Testing & Engine Hardening ([tests/test_phase1_custom_edge_cases.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/tests/test_phase1_custom_edge_cases.py))**:
   - Authored 27 additional custom edge-case and stress test cases:
     - **Adversarial Candlestick Physics**: Non-finite numbers (`NaN`, `+Inf`, `-Inf`, `-0.0`) rejected via `math.isfinite()`; Doji/circuit limit locks (`open == high == low == close`) handled; sub-penny tick precision (₹0.05, ₹0.15) verified; inverted geometries rejected.
     - **Temporal Chaos Monkey**: 1,000 randomized, completely scrambled events in `DataAlignmentQueue` restored to strictly non-decreasing chronological order; triple-collision at identical microsecond ($T_{\text{action}} = T_{\text{news}} = T_{\text{bar}}$) verifies priority invariants (CorporateAction priority 0 released on ex-date, News priority 1 held until $T+1$ due to latency, PriceBar priority 2 advances clock); 500-article high-velocity news burst buffered and released in FIFO order; multi-asset synchronous ticks verified without news duplication; post-market long weekend gap correctly queues news across holidays.
     - **Explicit Temporal Ordering Guard**: Hard `ValueError` raised on out-of-order bars (`bar.timestamp < self._sim_clock`), resilient under optimized execution (`python -O`).
     - **Calendar Boundaries**: Leap year Feb 29 2024 active session; Mumbai parliamentary & state election ad-hoc holidays; microsecond session boundary precision (`09:14:59.999999` vs `09:15:00.000000`, `15:30:00.000000` vs `15:30:00.000001`); multi-timezone round-trip invariants (UTC, IST, US/Eastern, Asia/Tokyo).
     - **FastBarBuffer Hot-Path**: Warm-up cold-start padding verified (insufficient history padded with row 0 replicas); `window_size <= 0` raises `ValueError`; out-of-bounds raises `IndexError`; C-contiguous float64 memory layout; safe empty buffer.
     - **Parquet Columnar Cache Stress**: Overlapping incremental appends automatically deduplicate; corrupted/zero-byte files fail gracefully with `None` fallback; caret index sanitization (`^NSEI` -> `INDEX_NSEI_1d.parquet`).
     - **Corporate Action & Discontinuity Auditor**: Precise 20% statutory circuit boundary tested (19.999% clean vs 20.001% flagged); reverse split 1000% jump reconciled with registered action; unsorted input bars sorted internally before auditing.
   - Comprehensive Verification Results:
     - `uv run pytest tests/ -v`: **46 passed in 2.27s** (100% pass rate).
     - `uv run mypy src/ tests/`: **Success: no issues found in 17 source files** (strict mode).
     - `uv run ruff check src/ tests/`: **All checks passed!**
     - `uv run ruff format --check src/ tests/`: **16 files already formatted.**

---

## 8. Implementation Progress: Phase 2 Completed

**Phase 2: Alternative Data & News/Social Ingestion** is 100% complete, hardened, and verified:

1. **Free Financial News & Social Ingestion ([src/data/news_scraper.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/src/data/news_scraper.py))**:
   - `scrape_rss_feed`: Live parsing of top Indian financial portals (Moneycontrol, Economic Times, LiveMint, Business Standard) via `feedparser` and `httpx`.
   - `scrape_reddit_public`: Scrapes retail sentiment from Reddit `r/IndianStreetBets` and `r/IndiaInvestments` using free public JSON feeds (`https://www.reddit.com/r/{sub}/new.json`), requiring zero paid API keys or developer subscriptions.
   - `compute_article_fingerprint`: Cryptographic SHA-256 fingerprinting deduplicator discarding duplicate stories across syndication networks.
   - `generate_mock_news_stream`: Deterministic synthetic point-in-time financial news generator for offline backtests.

2. **Rule-Based Longest-Match-First Named Entity Resolution ([src/data/entity_mapper.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/src/data/entity_mapper.py))**:
   - Covers ~100 liquid Indian equities and major market indices (`^NSEI`, `^INDIAVIX`, `^BSESN`, `^NSEBANK`).
   - Longest-match-first sorting prevents prefix shadowing (e.g. `"Tata Motors"` matches before `"Tata"`).
   - Strict regex word boundaries (`\b`), cashtags (`$INFY`), and corporate renames (`Zomato` $\rightarrow$ `ETERNAL.NS`, `TaMo` $\rightarrow$ `TMPV.NS`).
   - False-positive blacklist systematically suppresses ambiguous English words (`IT`, `ON`, `CAN`, `FOR`, `BE`) unless accompanied by explicit ticker cashtags or company context.
   - Headline priority rule assigns article title matches as `primary_ticker`.

3. **3-Sigma Rolling $z$-Score Mention Velocity Tracker ([src/data/mention_tracker.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/src/data/mention_tracker.py))**:
   - Maintains a sliding 7-day window (168 hourly buckets) per ticker.
   - Computes rolling baseline mean ($\mu_{7\text{d}}$) and standard deviation ($\sigma_{7\text{d}}$) with division-by-zero protection.
   - Dynamically triggers a $3\sigma$ watchlist alert when $z \ge 3.0$ and current hour count $\ge \text{min\_mentions}$ (3).

4. **Point-in-Time News Alignment & CLI Integration**:
   - Validated that breaking news during market hours ($t$) is strictly barred from trading on bar $t$; orders execute at the earliest at the open of bar $t+1$.
   - Post-market and weekend news is held in `_pending_news` and released at 09:15 IST next trading session.
   - Added `--test-mention-velocity` and `--scrape-news` CLI flags in [main.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/main.py).

5. **Automated Verification Suite ([tests/test_phase2_news.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/tests/test_phase2_news.py))**:
   - 13 comprehensive unit and integration tests passing in 1.46s.
   - Total test suite status: **59 passed in 1.82s** across Phase 0, Phase 1, and Phase 2.
   - Strict `mypy` static typing passes across all 21 source files with zero errors.
   - Full `ruff` check and format passing cleanly.

---

## 9. Immediate Next Task: Phase 3 Implementation Plan

The next phase to execute is **Phase 3: FinBERT Sentiment Inference Pipeline**.

### Scope of Phase 3:
1. **`src/nlp/finbert_pipeline.py`**:
   - Load `ProsusAI/finbert` via HuggingFace Transformers and PyTorch with local disk caching.
   - Tokenization with truncation/padding up to 512 tokens.
   - Inference pipeline outputting softmax probabilities: $P(\text{positive}), P(\text{negative}), P(\text{neutral})$.
   - Compute normalized composite sentiment score: $S = P(\text{positive}) - P(\text{negative}) \in [-1.0, 1.0]$.
2. **`src/nlp/sentiment_features.py`**:
   - Assemble point-in-time sentiment feature vector:
     - Raw score $S_t$
     - 24-hour sentiment momentum: $\Delta S = S_t - S_{t-24\text{h}}$
     - Mention velocity $z$-score from Phase 2
     - Confidence score: $1.0 - P(\text{neutral})$
3. **Inference Optimization**:
   - Optimize for CPU workstations using `torch.inference_mode()` and batched tensor evaluation (`batch_size = 32`).

