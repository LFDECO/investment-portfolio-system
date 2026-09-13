# Project Learnings & Technical Deep-Dive Handbook
## Event-Driven Quantitative Trading Simulation System

> **Welcome to the Technical Handbook!**  
> This document is an ongoing, chapter-by-chapter learning companion for our autonomous quantitative trading simulation engine. Each chapter breaks down a project phase in two ways:
> 1. **The Conceptual Big Picture**: An intuitive, jargon-free explanation of *what* we are building and *why* it matters, accessible even if you've never built a trading system before.
> 2. **The Nitty-Gritty Technical Mechanics**: A deep-dive into the engineering, architecture, and mathematics that make the approach sound, robust, and institutional-grade.

---

## Table of Contents
- [Chapter 0: Subsystem Architecture & Python Bootstrap](#chapter-0-subsystem-architecture--python-bootstrap)
- [Chapter 1: Free Market Data Ingestion & Strict Time-Series Alignment](#chapter-1-free-market-data-ingestion--strict-time-series-alignment)
- *(Upcoming Chapters: Financial NLP, Technical Indicators, Farama Gym Env, Strategy Agents, Purged Walk-Forward CV, Telemetry, and Cloud Deployment)*

---

# Chapter 0: Subsystem Architecture & Python Bootstrap

## 1. The Big Picture (Intuitive Overview)

### Why Two Languages? (TypeScript + Python)
Our existing web application ([Portfolio.Ai](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system)) is built with **TypeScript, React, Node.js, and MySQL**. This stack is world-class for fast, interactive web user interfaces, dashboards, authentication, and REST/tRPC APIs.

However, **quantitative finance and algorithmic trading** have fundamentally different computational demands:
- Fast vectorized matrix mathematics across millions of data points (calculating moving averages, volatility, Sharpe ratios).
- Machine learning, Deep Learning, and Natural Language Processing (NLP) models like BERT.
- Reinforcement Learning simulation environments (Farama Gymnasium).

Python is the undisputed global lingua franca for quantitative finance and ML. Rather than attempting to force heavy matrix calculations or neural network tensor operations into JavaScript, we built a **dedicated Python quantitative subsystem** that lives harmoniously alongside our TypeScript project.

```
┌─────────────────────────────────────────────────────────────┐
│                      PORTFOLIO.AI                           │
├──────────────────────────────┬──────────────────────────────┤
│  TypeScript / React / Node   │       Python Subsystem       │
│  • User Dashboard & Auth     │  • Data Ingestion & Scrapers │
│  • Interactive Charts        │  • FinBERT Sentiment Engine  │
│  • Holdings & Buy/Sell UI    │  • Gymnasium Simulation Env  │
│  • Database Models (Drizzle) │  • Purged Walk-Forward CV    │
└──────────────────────────────┴──────────────────────────────┘
```

---

## 2. What Was Done & Why It Matters

### A. Why `uv` Instead of Traditional `pip` or `conda`?
In Python, managing packages has historically been slow and fraught with dependency conflicts. A tool called `pip` downloads packages one by one, often taking 5–10 minutes to install large libraries like PyTorch and Transformers.

We chose **`uv`**, a modern, high-speed Python package and project manager written in Rust:
- **10x to 100x Faster**: `uv` installed 76 complex machine learning packages (including PyTorch, HuggingFace Transformers, and Gymnasium) in just **31 seconds**.
- **Automatic Python Runtime Management**: Even if a developer doesn't have Python 3.11 installed on their machine, `uv` automatically downloads an isolated, optimized CPython 3.11 binary in user space without touching system files.
- **Deterministic Lockfiles**: It ensures that anyone running this project on Windows, macOS, or Linux gets the exact same byte-for-byte package versions.

### B. Why Python 3.11?
Python 3.11 introduced major internal interpreter optimizations (the "Faster CPython" initiative), running roughly **25% faster** than Python 3.10 out of the box. In algorithmic simulations where an agent might evaluate hundreds of thousands of candles in a loop, raw execution speed matters.

### C. Why Strict Typing (`mypy`) and Static Analysis (`ruff`)?
Python is dynamically typed by default. In a web script, having a variable switch from a number to a string might just cause a small glitch. In quantitative finance, a silent type coercion:
- Passing string `"269.10"` instead of float `269.10`
- Passing an array with a `null` value into a Sharpe ratio equation
- Accidentally calculating `price - None`

...will cause the entire trading simulation to crash mid-backtest or produce mathematically corrupt returns.
- **`mypy`** in strict mode enforces that every function parameter, return value, and class attribute is explicitly typed and statically validated before code ever runs.
- **`ruff`** is a blazingly fast linter that enforces clean code hygiene, prevents unused imports, and enforces modern Python idioms.

---

## 3. The Nitty-Gritty Technical Mechanics

### Pydantic v2 and the Principle of Immutability
All data flowing through our simulation (market bars, news headlines, sentiment scores, orders, and executed trades) is modeled using **Pydantic v2**.

In [schemas.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/src/data/schemas.py), we defined a foundational base class:

```python
class StrictSchema(BaseModel):
    model_config = ConfigDict(
        strict=True,          # Forbid sneaky type conversions (e.g. "123" -> 123)
        frozen=True,          # IMMUTABLE: cannot be modified after creation!
        extra="forbid",       # Cannot inject random unexpected fields
        validate_default=True,
    )
```

#### Why is `frozen=True` (Immutability) So Critical?
Imagine a historical market candle for Power Grid Corporation:
```python
bar = PriceBar(
    timestamp=2026-09-11 15:30:00,
    ticker="POWERGRID.NS",
    open=269.95, high=274.05, low=268.35, close=269.10,
    volume=11421380
)
```
If this object were mutable, a rogue piece of code or an agent decision function could accidentally do:
```python
bar.close = 280.00  # Mutating the past!
```
By making our schemas **frozen (immutable)**, Python will instantly throw a `ValidationError` if any code tries to tamper with historical prices, orders, or fills. History is sealed in stone.

### The Subsystem Directory Architecture
We organized our Python codebase by functional responsibility:

| Directory | Responsibility | Key Files |
|---|---|---|
| `src/data/` | Price ingestion, news scraping, schemas | `price_fetcher.py`, `news_scraper.py`, `schemas.py` |
| `src/nlp/` | FinBERT model loading, headline scoring | `finbert_pipeline.py`, `sentiment_features.py` |
| `src/indicators/` | Technical analysis mathematical formulas | `technical.py`, `normalizer.py` |
| `src/env/` | Farama Gymnasium trading simulation | `trading_env.py`, `fee_model.py`, `slippage_model.py` |
| `src/strategy/` | Decision agents (heuristic & RL) | `base.py`, `momentum.py`, `sentiment.py`, `rl_agent.py` |
| `src/backtest/` | Cross-validation and regime stress testing | `walk_forward.py`, `regime.py`, `runner.py` |
| `src/analytics/` | Trade telemetry logs and QuantStats | `telemetry.py`, `metrics.py`, `reporting.py` |
| `src/bridge/` | Communication with Portfolio.Ai TypeScript UI | `database.py`, `sync.py` |

---

# Chapter 1: Free Market Data Ingestion & Strict Time-Series Alignment

## 1. The Big Picture (Intuitive Overview)

### The "Garbage In, Garbage Out" Trap in Trading
In software engineering, if you feed bad data to a database, you get an error message.  
In quantitative finance, if you feed bad data to a trading model, **it doesn't give you an error message — it gives you an illusion of infinite wealth.**

If your data pipeline has even the tiniest flaw:
- It uses data from 3:30 PM to make a decision at 9:30 AM.
- It fails to handle timezones and compares London time to Mumbai time.
- It forgets that the market was closed on Diwali or a national holiday and invents prices.

...your algorithm will look like an absolute genius during backtesting on your laptop, but the very first day you let it run in the real world, it will lose money rapidly.

Phase 1 is dedicated to building the **Data Foundation**: ingesting clean, historical and real-time price bars for Indian stocks (NSE) using **100% free data sources**, while enforcing **strict point-in-time chronological integrity**.

---

## 2. The Core Challenge: What is Look-Ahead Bias?

### An Everyday Analogy
Imagine you are placing bets on football matches. 
If someone secretly slips you tomorrow morning's newspaper showing the final scores before kickoff, betting on the winning team is effortless. You would win 100% of your bets.

In quantitative code, **look-ahead bias** is when information from the *future* accidentally leaks into the decision-making code of the *past*.

### How Look-Ahead Bias Sneaks In (Real Examples):
1. **The Daily Close Trap**:
   A strategy says: *"If today's close is higher than yesterday's close, buy at 10:00 AM."*  
   *The problem:* At 10:00 AM, today's close hasn't happened yet! Today's close only exists at 3:30 PM. The code is peeking 5.5 hours into the future.
2. **Centered Moving Averages**:
   In data science, many people use `pandas.rolling(window=5, center=True)`.  
   *The problem:* A centered window for Tuesday averages Monday, Tuesday, **Wednesday, and Thursday**. Tuesday's indicator is now derived from Thursday's price!
3. **Improper Timestamp Alignment**:
   A news article is published at 11:00 AM. If the algorithm applies that news sentiment to the 10:00 AM – 11:00 AM hourly candlestick, it is trading on news that hadn't broken yet.

```
CORRECT (Point-in-Time Reality):
Time: -------------------> t (Now) -------------------> t+1 (Future)
Known Data: [t-2, t-1, t]  | Agent decides & buys here    [UNKNOWN]

LOOK-AHEAD BIAS (Future Leakage - FORBIDDEN):
Time: -------------------> t (Now) -------------------> t+1 (Future)
Leaked Data: [t-2, t-1, t, t+1]  <-- Agent peeks at t+1 before it happens!
```

---

## 3. What We Are Building in Phase 1

### A. Free Multi-Asset Ingestion (`price_fetcher.py`)
- We use **`yfinance`** combined with direct NSE endpoint fallbacks.
- Every Indian stock on the National Stock Exchange requires the `.NS` suffix (e.g. `POWERGRID.NS`, `ONGC.NS`, `RELIANCE.NS`).
- Our fetcher automatically sanitizes user ticker inputs, maps them to standard exchange notation, and retrieves OHLCV candlestick bars:
  - **O**pen: Price at the start of the bar
  - **H**igh: Highest price during the bar
  - **L**ow: Lowest price during the bar
  - **C**lose: Final traded price of the bar
  - **V**olume: Total shares traded during the bar

### B. Timezone Normalization (IST & UTC)
The Indian Stock Market operates in **Indian Standard Time (IST)**, which is `UTC + 05:30`.
- Standard NSE regular trading session: **09:15 AM to 03:30 PM IST**.
- Market pre-open: **09:00 AM to 09:15 AM IST**.
- All timestamps in our database and internal engine are stored in **UTC** with explicit timezone awareness, but evaluated and filtered according to the **IST market session window**.

```
IST Market Clock:
09:00 IST             09:15 IST                     15:15 IST           15:30 IST
   │                     │                             │                   │
   ▼                     ▼                             ▼                   ▼
Pre-Open Session ───► Market Open ────────────────► EOD Square-Off ───► Market Closes
(Order Matching)     (Trading Begins)             (Close Intraday)    (Settlement)
```

### C. The NSE Trading Calendar & Holiday Filter
Stock markets do not trade on weekends or designated national holidays (e.g., Independence Day, Republic Day, Diwali, Holi).
- If a data fetcher blindly expects a 5-minute bar every single day, it will crash on gaps or accidentally interpolate non-existent prices.
- Phase 1 integrates an **NSE Trading Calendar** that knows every official trading holiday. Gaps across weekends and holidays are treated as valid market closures, preserving realistic price jump (gap-up / gap-down) dynamics.

### D. The Chronological Event Queue (`DataAlignmentQueue`)
In our event-driven simulation, market prices, news articles, and social chatter arrive from different sources at different speeds.
How do we ensure they play out like a real-time movie without ever mixing up the sequence?

We implement an **Asynchronous Priority Queue**:
1. Every market event (a 5-minute price candle, a breaking news article, a Reddit post) is given a strictly comparable UTC timestamp.
2. The queue orders all events in chronological sequence ($t_0 \le t_1 \le t_2$).
3. The simulation environment pops events from the queue one tick at a time.
4. **The Golden Rule**: The trading agent is *only* shown the event popped at time $t$. The rest of the queue remains strictly invisible until simulated time progresses.

---

## 4. How This Approach is Technically Sound

1. **Zero Future Contamination (Causal Invariant)**:
   Every feature vector $X_t$ is mathematically guaranteed to be a pure function of data up to time $t$:
   $$\forall X_t, \quad X_t = f(\{D_\tau \mid \tau \le t\})$$
2. **Deterministic Replayability**:
   Given the same date range and the same ticker universe, running the pipeline 100 times will produce the exact same sequence of events down to the microsecond.
3. **No Paid API Lock-In**:
   The entire data ingestion engine operates using free, publicly available market endpoints, making the project completely accessible and zero-cost to maintain.

---

## Quick Reference: Glossary for Beginners

| Term | Meaning |
|---|---|
| **OHLCV** | Open, High, Low, Close, Volume — the 5 standard numbers describing every candle on a financial chart. |
| **Candlestick** | A visual bar showing the price movement over a specific time window (e.g., 5 minutes or 1 day). |
| **IST** | Indian Standard Time (UTC+5:30). The official timezone for the National Stock Exchange of India (NSE). |
| **Look-Ahead Bias** | An error where an algorithm accidentally uses future information to make past decisions. |
| **Pydantic** | A Python library that verifies that data matches exact expected types and shapes before code uses it. |
| **Immutability** | An object state that cannot be modified after it is created, preventing accidental data tampering. |
| **Priority Queue** | A data structure that automatically sorts items so the earliest timestamp is always processed first. |
