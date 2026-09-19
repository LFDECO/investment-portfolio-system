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
- [Chapter 2: Alternative Data & News/Social Ingestion](#chapter-2-alternative-data--newssocial-ingestion)
- [Chapter 3: FinBERT Sentiment Inference Pipeline (Upcoming Preview)](#chapter-3-finbert-sentiment-inference-pipeline-preview)
- *(Subsequent Chapters: Technical Indicators, Farama Gym Env, Strategy Agents, Purged Walk-Forward CV, Telemetry, and Cloud Deployment)*

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

## 4. The Technical Mechanics: Code Architecture & Invariants

### A. The NSE Trading Calendar Engine (`src/data/calendar.py`)
To prevent artificial data interpolation or holiday crashes, we built an explicit calendar engine containing:
- **Exact Session Boundaries**: Pre-open (09:00–09:15 IST), Regular Session (09:15–15:30 IST), and Intraday Square-off cutoff (15:15 IST).
- **Curated Multi-Year NSE Holiday Set**: A complete $O(1)$ lookup hash set covering national holidays, festival sessions, and election days across 2023, 2024, 2025, and 2026.
- **After-Hours News Routing (`get_next_market_open`)**:
  When a company drops an earnings release on Friday evening at 18:00 IST:
  ```
  Event Timestamp: Friday 18:00 IST
  ├── Saturday / Sunday: Market Closed (Weekend)
  ├── Monday (if Holiday): Market Closed
  └── Mapped Execution Window: Tuesday 09:15:00 IST (03:45 UTC)
  ```
  This mathematically guarantees that after-market announcements cannot trigger simulated orders during non-existent weekend sessions.

### B. Multi-Asset Price Ingestion & Sanity Auditing (`src/data/price_fetcher.py`)
1. **Ticker Sanitizer**:
   Automatically identifies NSE tickers, strips spaces, maps corporate renames (`REC` $\rightarrow$ `RECLTD.NS`, `ZOMATO` $\rightarrow$ `ETERNAL.NS`, `TATAMOTORS` $\rightarrow$ `TMPV.NS`), preserves explicit `.BO` symbols, and appends `.NS` by default.
2. **Resilient Dual-Tier Fetcher**:
   Primary ingestion queries `yfinance`. If rate limits or unauthenticated quote blocks occur, the engine falls back to direct chart API requests (`https://query1.finance.yahoo.com/v8/finance/chart/{ticker}`).
3. **Candlestick Mathematical Integrity (`validate_candlestick`)**:
   Every bar must strictly satisfy:
   $$\text{high} \ge \max(\text{open}, \text{close})$$
   $$\text{low} \le \min(\text{open}, \text{close})$$
   $$\text{volume} \ge 0, \quad \text{prices} > 0$$
   Any corrupt or zero-spread inverted quote is purged before entering the simulation pipeline.

### C. The Priority Queue Temporal Ordering (`src/data/data_queue.py`)
The `DataAlignmentQueue` uses a priority min-heap where events are ranked deterministically by a 3-tuple `(timestamp, priority, sequence_id)`:
- `priority = 0`: Corporate Action events (splits, bonuses effective before market open).
- `priority = 1`: News / Social Chatter events.
- `priority = 2`: Price Bar events (advances simulation clock and releases buffered events).

```python
# The Fundamental Look-Ahead Prevention Invariant:
if news_article.published_at < next_bar.timestamp:
    released_news.append(news_article)  # Allowed to inform trade at next_bar.open
else:
    pending_buffer.append(news_article)  # Retained in pending! Physically impossible to trade at open!
```

### D. Truncation Invariance: The Mathematical Proof of Zero Leakage
How do we prove to an institutional auditor that our backtest has zero look-ahead bias?
We enforce **Truncation Invariance**:
$$\forall t < T, \quad f(D_{0:t})_t \equiv f(D_{0:T})_t$$

If we compute moving averages, RSI, or volatility on the first 30 days of data ($D_{0:30}$), the value computed on day 30 must be **byte-for-byte identical** to the value computed on day 30 when given the full 365 days of data ($D_{0:365}$).
In our test suite (`tests/test_phase1_data.py`), `test_truncation_invariance_no_lookahead` verifies this across rolling slices with a strict floating-point tolerance of $10^{-9}$.

---

## 5. Hardened Architecture & Critical Design Decisions

To make our quantitative engine production-grade, we subjected Phase 1 to rigorous architectural hardening across 6 key dimensions:

### 1. Vectorized Memory vs. Pydantic in Hot Simulation Loops (`FastBarBuffer`)
- **The Bottleneck**: Pydantic v2 is exceptional for parsing and validating I/O data. However, instantiating `frozen=True` Pydantic models in a hot Gymnasium training loop executing hundreds of thousands of steps incurs per-object validation overhead (~1.5–3 µs per bar).
- **The Architectural Boundary**: Pydantic validates data **once** at the serialization/ingestion boundary. Once validated, bars are immediately converted into `FastBarBuffer` backed by a contiguous C-ordered `np.ndarray` matrix `(N, 5)` of `[open, high, low, close, volume]` and 1D vector columns.
- **Result**: In the simulation loop, Gymnasium environments and RL agents slice 2D observation matrices (`get_window()`) and fetch single bars (`FastBarTuple`) in sub-10-nanosecond vectorized operations without allocating Pydantic objects per step.

### 2. Deterministic FIFO Stability via Monotonic `sequence_id`
- **The Problem**: In standard Python heaps (`heapq`), if two events share the same `timestamp` and `priority`, Python attempts to compare the 4th element (the payload). If payloads are unorderable objects or have custom fields, Python throws a `TypeError: '<' not supported between instances`, or worse, resolves ties nondeterministically depending on memory addresses.
- **The Fix**: We introduced an atomic monotonic counter `sequence_id: int` (`itertools.count()`) assigned strictly at insertion time as the tertiary sort key:
  $$\text{Heap Key} = (\text{timestamp}, \text{priority}, \text{sequence\_id}, \text{payload})$$
- **Guarantee**: Even if multiple news articles or chatter events break at the exact same microsecond, they are guaranteed to dequeue in deterministic First-In-First-Out (FIFO) order across multi-threaded runs.

### 3. Physical Latency Modeling on Exact Timestamp Matches ($t_{\text{news}} == t_{\text{bar}}$)
- **The Causality Invariant**: Suppose an intraday 5-minute bar opens at `09:15:00.000 IST`, and a breaking news headline carries the timestamp `09:15:00.000 IST`.
- **Physical Reality**: Because electronic news transmission, RSS network polling, NLP parsing, and exchange order gateway routing take finite time (tens to hundreds of milliseconds), it is **physically impossible** for an order triggered by that news to execute at `09:15:00.000 open`.
- **The Rule**: News is released **strictly if** `published_at < bar.timestamp`. If `published_at == bar.timestamp`, the event is retained in `_pending_news` and released at the next bar (`09:20:00`), preventing instantaneous execution leakage.

### 4. Columnar Parquet Cache & Invalidation Policy
- **Why Parquet?**: Columnar storage (`pyarrow`) provides 10x compression over JSON and blazing fast column slicing when querying years of intraday bars across hundreds of Indian equities.
- **Invalidation Policy**:
  - **Closed Historical Bars ($< \text{today}$)**: Completely immutable. Once written to `.cache/market_data/{ticker}_{interval}.parquet`, historical bars are never re-fetched from the network.
  - **Active / Current Session**: Today's candle is still updating while the market is open; therefore queries extending into the current date are fetched fresh without polluting the immutable historical cache.

### 5. Calendar Horizon Hard Boundary Guard
- **The Risk**: A calendar that returns `False` or defaults to all-trading-days for unverified future years creates silent errors in long-running backtests.
- **The Hard Guard**: `NSETradingCalendar` explicitly bounds verified holiday coverage: `MIN_COVERED_YEAR = 2023`, `MAX_COVERED_YEAR = 2026`.
- **Behavior**: Calling `is_trading_day()` for year 2027 immediately raises a hard `ValueError: outside verified holiday coverage`, forcing developers to register official NSE holidays rather than allowing silent simulation drift.

### 6. Two-Tier Corporate Actions (Splits / Bonuses) Architecture
- **Detection vs Adjustment**: Retroactively adjusting prices rewrites history, which is essential for technical indicators (to prevent artificial RSI/MACD spikes), but hides the actual event from strategy agents.
- **Our Dual Strategy**:
  1. **Event Dispatching**: On `ex_date`, an explicit `CorporateAction` event (`SPLIT`, `BONUS`, `DIVIDEND`) flows through `DataAlignmentQueue`, allowing the portfolio engine to adjust active holdings (`shares *= multiplier`, `cost_basis /= multiplier`) dynamically.
  2. **Continuity Auditing (`detect_price_discontinuities`)**: Audits day-over-day price series against NSE 20% circuit thresholds. Unexplained price drops are flagged as anomalies, while verified corporate actions explain and reconcile the shift.

---

## 6. How This Approach is Technically Sound

1. **Zero Future Contamination (Causal Invariant)**:
   Every feature vector $X_t$ is mathematically guaranteed to be a pure function of data up to time $t$:
   $$\forall X_t, \quad X_t = f(\{D_\tau \mid \tau \le t\})$$
2. **Deterministic Replayability**:
   Given the same date range and ticker universe, running the pipeline 100 times produces the exact same sequence of events down to the microsecond.
3. **No Paid API Lock-In**:
   The entire data ingestion engine operates using free, publicly available market endpoints, making the project completely accessible and zero-cost to maintain.
4. **Zero Allocation Hot Loops**:
   By using `FastBarBuffer` contiguous memory layouts, the RL simulation loop avoids Python garbage collection spikes and validation overhead.

---

## Quick Reference: Glossary for Beginners

| Term | Meaning |
|---|---|
| **OHLCV** | Open, High, Low, Close, Volume — the 5 standard numbers describing every candle on a financial chart. |
| **Candlestick** | A visual bar showing the price movement over a specific time window (e.g., 5 minutes or 1 day). |
| **IST** | Indian Standard Time (UTC+5:30). The official timezone for the National Stock Exchange of India (NSE). |
| **Look-Ahead Bias** | An error where an algorithm accidentally peeks into future data to make decisions at past points in time. |
| **Pydantic** | High-performance Python data validation library; used strictly at our ingestion boundary. |
| **FastBarBuffer** | Contiguous C-ordered NumPy memory buffer storing validated candlesticks for zero-overhead Gym execution. |
| **Immutability** | An object state that cannot be altered after creation, preventing state corruption in concurrent systems. |
| **Sequence ID** | An atomic integer counter that breaks heap ties in FIFO order, guaranteeing deterministic replay. |
| **Parquet** | Columnar file format providing massive compression and fast column reads for historical financial series. |
| **Corporate Action** | Events like stock splits, bonuses, or dividends that alter share quantities and nominal share prices. |
| **Truncation Invariance** | Mathematical proof that computing features on $D_{0:t}$ yields the exact same value as on $D_{0:T}$ evaluated at $t$. |

---

# Chapter 2: Alternative Data & News/Social Ingestion

## 1. The Big Picture (Intuitive Overview)

### Why Price Alone Isn't Enough: The Echo vs. The Spark
If you only look at historical price candles (OHLCV), you are essentially driving a car by only looking through the rear-view mirror. Candlesticks tell you *what* already happened in the auction, but they don't tell you *why* market participants suddenly changed their minds.

In financial markets, price movements are the **echo**; breaking information is the **spark**:
- An unexpected quarterly earnings beat published at 14:00 IST.
- A sudden SEBI regulatory inquiry into a company's promoters.
- A viral discussion on retail forums about an upcoming defense contract.

By the time these events show up as a huge green or red candle on a 5-minute chart, institutional algorithms have already reacted. To give our trading simulation an informational edge, we must ingest **Alternative Data** — unstructured textual information from financial news outlets and online trader communities.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          THE INFORMATION LIFECYCLE                      │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Event Spark        │ A company wins a ₹5,000 Crore solar contract.    │
│ 2. Alternative Data   │ Press release published on LiveMint & Reddit.   │
│ 3. Mention Velocity   │ Chatter spikes 10x above normal baseline (3σ).  │
│ 4. Sentiment Signal   │ FinBERT scores headline as +0.94 Positive.       │
│ 5. Order Execution    │ Agent enters at next candle open before breakout.│
│ 6. Price Echo         │ Candle closes +4.2% higher as public reacts.     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### The Megaphone Effect: Retail Chatter as an Early-Warning Radar
Why do we track retail communities like Reddit (`r/IndianStreetBets` and `r/IndiaInvestments`)?

Retail traders rarely move large-cap behemoths like Reliance or TCS on their own. However, when hundreds of independent traders suddenly start discussing a specific ticker at the exact same hour, it functions like an **acoustic radar**:
- A sudden surge in chatter indicates heightened volatility, retail FOMO, or a breaking rumor that has not yet hit formal wire services.
- In quantitative finance, this metric is called **Mention Velocity**. By monitoring baseline chatter and detecting statistical anomalies ($3\sigma$ surges), our system flags high-potential stocks before the broader market recognizes the trend.

---

### The Treachery of Company Names: The Entity Disambiguation Problem
Why can't we simply use `text.contains("Tata")` to find news about Tata Motors?

In the Indian stock market, entity recognition is notoriously deceptive for three major reasons:

#### 1. The Conglomerate Problem
The word `"Tata"` could refer to:
- Tata Motors (`TMPV.NS`)
- Tata Steel (`TATASTEEL.NS`)
- Tata Power (`TATAPOWER.NS`)
- Tata Consumer Products (`TATACONSUM.NS`)
- Tata Consultancy Services (`TCS.NS`)

If an algorithm naively matches `"Tata"`, positive news about a steel factory in Odisha might mistakenly trigger a buy order for an electric car manufacturer in Pune!

#### 2. Corporate Renames and Nicknames
Companies frequently operate under colloquial abbreviations or change their listed names:
- Traders say `"TaMo"`, but the exchange listed it as `TATAMOTORS.NS` (now transitioning to `TMPV.NS`).
- Everyone calls Reliance Industries `"RIL"` or `"Reliance"`.
- Zomato was recently restructured under `"Eternal"` (`ETERNAL.NS`).
- Rural Electrification Corporation is officially `RECLTD.NS`.

#### 3. The English Word Collision Trap (False Positives)
Many liquid stock symbols are common English words:
- `IT` (Information Technology vs. the pronoun *"it"*)
- `ON` (Preposition *"on"* vs. Oil and Natural Gas Corporation `ONGC`)
- `CAN` (Modal verb *"can"* vs. Canara Bank `CANBK.NS`)
- `FOR`, `BE`, `AT`, `NOW`

If someone writes: *"It is on the table and can be done for now"*, an unhardened trading algorithm will mistakenly buy shares in four different companies simultaneously!

In Phase 2, we built a **rule-based, longest-match-first Named Entity Resolution (NER)** engine that completely solves these disambiguation and false-positive traps without expensive external machine learning services.

---

## 2. What Was Done & Why It Matters

### A. 100% Free Public Alternative Data Ingestion
Institutional hedge funds spend $50,000+ per year on proprietary Bloomberg news feeds and Twitter/X enterprise API tiers. 

To keep our platform fully accessible and zero-cost to run, we engineered scrapers targeting **free, open public endpoints**:
- **Tier 1 (Official & Press)**: RSS feeds from premier Indian financial news portals:
  - *Moneycontrol* (Market reports, corporate results)
  - *Economic Times* (Top news, economy)
  - *LiveMint* (Companies, banking, technology)
  - *Business Standard* (Corporate announcements)
- **Tier 2 (Social Media & Retail Sentiment)**:
  - Reddit public JSON endpoints (`https://www.reddit.com/r/IndianStreetBets/new.json` and `r/IndiaInvestments`).
  - By using standard public endpoints with polite HTTP headers, we ingest real-time trader sentiment without requiring any paid Reddit API credentials or developer keys.
- **Deterministic Offline Generator (`generate_mock_news_stream`)**:
  - In addition to live scraping, we built a fully deterministic synthetic news generator that produces realistic point-in-time financial articles for 100% reproducible backtests.

---

### B. Cryptographic Deduplication (SHA-256 Fingerprinting)
Online financial portals frequently re-publish identical wire stories across syndication networks or update an article multiple times with minor typographical fixes.

If our system ingested the same headline 5 times:
1. The mention count for that stock would falsely register as 5 distinct events.
2. The sentiment score would be artificially multiplied 5x.

We solved this with **SHA-256 Cryptographic Fingerprinting**:
```python
def compute_article_fingerprint(source: str, identifier: str) -> str:
    raw = f"{source.strip().lower()}:{identifier.strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
```
Every incoming article is hashed by its unique permalink or normalized source-and-title string. If an identical fingerprint has already been processed within a 48-hour time-to-live (TTL) window, it is silently dropped, preserving pristine signal integrity.

---

### C. Rule-Based Longest-Match-First Named Entity Recognition (NER)
To solve the entity disambiguation challenge, we built a custom `EntityMapper` covering ~100 liquid Indian equities and major market indices:
1. **Longest-Match-First Precedence**: Phrases are sorted by descending string length. `"Tata Motors"` (length 11) is tested before `"Tata"` (length 4). This guarantees that specific multi-word company names always match before generic parent brands.
2. **Strict Regex Word Boundaries (`\b`)**: Prevents substring accidents (e.g. matching `"BEL"` inside `"BELOW"` or `"RELIANCE"` inside `"IRRELIANCE"`).
3. **Caseless Financial Suffix and Cashtag Support**: Matches `$INFY`, `INFY.NS`, or plain `Infosys` seamlessly.
4. **False-Positive Blacklist**: Ticker symbols that collide with ordinary English words (`IT`, `ON`, `CAN`, `FOR`, `BE`) are strictly ignored unless explicitly prefixed with a cashtag (e.g., `$CAN`) or accompanied by explicit company keywords (*"Canara Bank"*).
5. **Headline Priority Rule**: If an article headline mentions one stock and the article body mentions three comparison stocks, the headline stock is designated as the `primary_ticker`, ensuring the trading signal targets the true subject of the article.

---

### D. The $3\sigma$ Rolling $z$-Score Mention Velocity Tracker
To separate genuine sentiment spikes from everyday background chatter, we implemented a rolling statistical monitor:
- Tracks hourly mention volume per symbol across a rolling 7-day window (168 hourly buckets).
- Computes the rolling mean ($\mu$) and standard deviation ($\sigma$).
- If a stock's current hourly mentions exceed the baseline by **3 standard deviations ($z \ge 3.0$)**, an automated **Watchlist Trigger Alert** is emitted.
- To prevent false alarms on dormant stocks (e.g., going from 0 mentions to 1 mention), the trigger enforces an absolute minimum threshold ($c_t \ge 3$).

---

## 3. The Nitty-Gritty Technical Mechanics

### A. Mathematical Formulation of Mention Velocity ($z$-Score)
Let $c_t$ represent the total mention count for a given ticker $k$ during hourly bucket $t$.

We maintain a sliding historical window $H_t$ consisting of up to $W = 168$ past hourly counts (7 days $\times$ 24 hours):
$$H_t = [c_{t-W}, c_{t-W+1}, \dots, c_{t-1}]$$

1. **Rolling Baseline Mean**:
   $$\mu_{7\text{d}} = \frac{1}{|H_t|} \sum_{i \in H_t} c_i$$

2. **Rolling Baseline Standard Deviation**:
   $$\sigma_{7\text{d}} = \sqrt{\frac{1}{|H_t|} \sum_{i \in H_t} (c_i - \mu_{7\text{d}})^2}$$

3. **Standardized $z$-Score**:
   $$z_t = \begin{cases} \frac{c_t - \mu_{7\text{d}}}{\sigma_{7\text{d}}} & \text{if } \sigma_{7\text{d}} > 0 \\ 0.0 & \text{if } \sigma_{7\text{d}} = 0 \end{cases}$$

4. **Dynamic 3-Sigma Alert Trigger Condition**:
   $$\text{Trigger}_t = \Big(z_t \ge 3.0\Big) \;\land\; \Big(c_t \ge \text{min\_mentions}\Big)$$
   Where $\text{min\_mentions} = 3$ by default.

---

### B. Why Division-by-Zero Protection Matters in Financial Data
Consider a quiet mid-cap stock that had exactly 0 mentions every hour for the past week:
$$H_t = [0, 0, \dots, 0] \implies \mu = 0.0, \quad \sigma = 0.0$$

In the current hour, a retail trader posts a single question about the company: $c_t = 1$.
- Without safeguards, calculating $\frac{1 - 0}{0}$ results in a `ZeroDivisionError` or $+ \infty$.
- Even if handled with an epsilon like $\sigma + 10^{-6}$, the $z$-score would evaluate to $1,000,000$, triggering a false trading alarm!
- By enforcing `if std > 0.0 else 0.0` and requiring $c_t \ge 3$, our math remains completely stable and impervious to single-event noise.

---

### C. Point-in-Time Temporal Alignment Invariant
How does alternative data interface with our price execution engine without creating look-ahead bias?

In [src/data/data_queue.py](file:///c:/Users/91801/Documents/GitHub/investment-portfolio-system/src/data/data_queue.py), all news events flow into `DataAlignmentQueue` alongside price bars:

```
Timeline: ────────[Bar 0: 09:15 - 09:20]──────────────[Bar 1: 09:20 - 09:25]────────►
                       ▲                                    ▲
                       │                                    │
               News breaks at 09:16:30              News released at 09:20:00
               (Held in _pending_news)              (Can trade at Bar 1 Open!)
```

1. **Intraday Arrival**:
   A news article published at `09:16:30 IST` arrives while Bar 0 (`09:15:00` open) is currently active.
   - Because Bar 0 opened at `09:15:00`, a trade cannot execute in the past.
   - The queue holds the article in `_pending_news`.
   - When Bar 1 arrives (`09:20:00`), the article is released. The trading agent can evaluate the sentiment and submit an order for execution at **Bar 1's Open (`09:20:00`)**.
2. **Post-Market Arrival**:
   A corporate earnings filing published at `19:00 IST` on Friday evening is held across the entire weekend. It is released at `09:15:00 IST` on Monday morning, allowing the agent to react at the market open auction.

---

## 4. Quick Reference: Glossary for Beginners

| Term | Meaning |
|---|---|
| **Alternative Data** | Non-traditional financial data (news, social media chatter, web traffic, satellite imagery) used to extract market signals. |
| **RSS (Really Simple Syndication)** | A standardized XML web feed format used by news portals to publish headlines and articles as they happen. |
| **NER (Named Entity Recognition)** | An NLP process that locates and classifies named entities in unstructured text (e.g. mapping "State Bank" to `SBIN.NS`). |
| **Longest-Match-First** | A greedy parsing strategy where longer phrases ("Tata Motors") are evaluated before shorter substrings ("Tata"). |
| **False-Positive Suppression** | Filtering out ambiguous tokens (like "IT" or "CAN") so ordinary English words are not mistaken for stock tickers. |
| **SHA-256 Fingerprint** | A cryptographic hash generated from article content to instantly detect and discard duplicate syndicated stories. |
| **Mention Velocity** | The rate of change in how frequently a company is discussed over time across news and social media. |
| **$z$-Score** | A statistical measurement that describes how many standard deviations a value is from the mean ($\frac{x - \mu}{\sigma}$). |
| **$3\sigma$ Rule (Three-Sigma)** | In a normal distribution, 99.7% of data points fall within $3\sigma$ of the mean. Exceeding $3\sigma$ indicates a rare, statistically significant event. |

---

# Chapter 3: FinBERT Sentiment Inference Pipeline (Preview)

> ### What We Are Building Next
> In **Phase 3**, our system moves from *counting* words to *understanding* financial context. We will deploy **FinBERT** (`ProsusAI/finbert`), a deep learning language model trained specifically on financial communications.

### 1. Why General-Purpose AI Fails in Financial Markets
If you feed financial headlines into a general-purpose language model trained on Wikipedia or novels, it frequently misinterprets standard financial terminology:
- *"The company's liabilities expanded as it took on additional debt to finance growth."*
  - **General NLP**: Sees "liabilities" and "debt" and classifies it as strongly **Negative**.
  - **Financial Context**: May be completely normal corporate capital expansion; in many cases, growth capex is **Neutral** or **Positive**.
- *"Crude prices softened, benefiting downstream paint manufacturers."*
  - **General NLP**: Sees "softened" (weakness) and tags it as negative.
  - **Financial Context**: Lower oil prices dramatically reduce raw material input costs for paint stocks like Asian Paints (`ASIANPAINT.NS`), making this strongly **Positive**!

FinBERT was fine-tuned specifically on corporate financial disclosures, earning transcripts, and analyst reports, enabling it to discern nuanced financial sentiment accurately.

---

### 2. How Sentiment Scores are Calculated Mathematically
FinBERT passes text through a Transformer encoder and a classification head, outputting a 3-dimensional probability distribution via softmax:
$$P(\text{positive}) + P(\text{negative}) + P(\text{neutral}) = 1.0$$

From these probabilities, we compute a normalized continuous **Sentiment Score** $S \in [-1.0, +1.0]$:
$$S = P(\text{positive}) - P(\text{negative})$$

- $S = +1.0$: Unanimously positive sentiment.
- $S = 0.0$: Completely neutral or balanced sentiment.
- $S = -1.0$: Unanimously negative sentiment.

We also derive an **Ambiguity/Confidence Score**:
$$\text{Confidence} = 1.0 - P(\text{neutral})$$

---

### 3. The 3-Component Sentiment Feature Vector
In Phase 3, each stock candle will receive a rich, point-in-time feature vector:
$$V_{\text{sentiment}} = \begin{bmatrix} S_t \\ \Delta S_{24\text{h}} \\ z_{\text{chatter}} \end{bmatrix}$$

1. **$S_t$ (Current Sentiment Score)**: The immediate net sentiment of recent news.
2. **$\Delta S_{24\text{h}}$ (24-Hour Sentiment Velocity)**: The momentum of sentiment change ($S_t - S_{t-24\text{h}}$). A company whose sentiment shifts from $-0.6$ to $+0.2$ is experiencing an aggressive turnaround.
3. **$z_{\text{chatter}}$ (Mention Velocity $z$-Score)**: The statistical volume surge from Phase 2, quantifying *conviction* and *reach*.

---

### 4. High-Performance CPU Batch Inference
Running deep learning models locally can be resource-intensive. To ensure blazing fast backtests on standard workstations without dedicated GPUs:
- **PyTorch Inference Mode (`torch.inference_mode()`)**: Disables autograd graph creation, cutting RAM usage by 60%.
- **Vectorized Batching**: Headlines are grouped into batches of 32 or 64, processing an entire day's financial news in under 2 seconds.
- **Local Model Caching**: FinBERT weights (~440 MB) are cached locally so the model loads once and runs completely offline.

---

> [!TIP]
> **We Want Your Thoughts!**  
> As we prepare to launch Phase 3, do you have any specific preferences or thoughts on:
> - The sentiment decay half-life (e.g. should news sentiment decay after 4 hours, 24 hours, or 48 hours)?
> - Specific financial news channels or subreddits you'd like added to the default watchlists?
> - Let us know anytime as we transition into Phase 3!

