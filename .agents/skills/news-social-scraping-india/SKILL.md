---
name: news-social-scraping-india
description: >-
  Scrape and ingest Indian financial news and social media chatter from free
  sources (MoneyControl, Economic Times, NSE announcements, Reddit
  r/IndianStreetBets). Use this skill when building the news/social feed
  pipeline, implementing mention velocity tracking, computing rolling z-score
  watchlist triggers, or aligning news event timestamps to subsequent candle
  opens to prevent look-ahead bias.
---

# News & Social Feed Scraping — India

This skill covers scraping, normalizing, and temporally aligning Indian
financial news and social media chatter for the sentiment pipeline.

---

## 1. Free Data Sources

### Tier 1 — Official Announcements (Highest Signal)

| Source | URL / Method | Content Type |
|---|---|---|
| NSE Corporate Filings | `https://www.nseindia.com/companies-listing/corporate-filings-announcements` | Board meetings, earnings, splits, buybacks |
| BSE Announcements | `https://www.bseindia.com/corporates/ann.html` | Regulatory filings, corporate actions |
| SEBI Orders | `https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=1` | Enforcement actions, regulatory orders |

### Tier 2 — Financial News (High Signal)

| Source | Method | Notes |
|---|---|---|
| MoneyControl | RSS: `https://www.moneycontrol.com/rss/latestnews.xml` | Largest Indian financial portal |
| Economic Times Markets | RSS: `https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms` | Market news feed |
| LiveMint | RSS: `https://www.livemint.com/rss/markets` | Financial news |
| Business Standard | RSS: `https://www.business-standard.com/rss/markets-106.rss` | Market coverage |

### Tier 3 — Social / Retail Chatter (Noisy but Volume-Informative)

| Source | Method | Notes |
|---|---|---|
| Reddit r/IndianStreetBets | PRAW API (free) | Indian retail trader discussions |
| Reddit r/IndiaInvestments | PRAW API | More conservative / long-term focus |
| StockTwits | REST API (free tier) | Ticker-tagged social posts |

---

## 2. Pydantic Schemas

```python
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

class NewsSource(str, Enum):
    NSE_FILING = "nse_filing"
    BSE_ANNOUNCEMENT = "bse_announcement"
    SEBI_ORDER = "sebi_order"
    MONEYCONTROL = "moneycontrol"
    ECONOMIC_TIMES = "economic_times"
    LIVEMINT = "livemint"
    BUSINESS_STANDARD = "business_standard"
    REDDIT_ISB = "reddit_indianstreetbets"
    REDDIT_II = "reddit_indiainvestments"
    STOCKTWITS = "stocktwits"

class NewsTier(str, Enum):
    OFFICIAL = "official"       # Tier 1: filings, regulatory
    NEWS = "news"               # Tier 2: professional journalism
    SOCIAL = "social"           # Tier 3: retail chatter

class NewsItem(BaseModel):
    """A single news or social media item."""
    source: NewsSource
    tier: NewsTier
    title: str
    body: str = ""
    url: str = ""
    published_at: datetime = Field(..., description="Original publication timestamp in UTC")
    scraped_at: datetime = Field(default_factory=lambda: datetime.now(tz=__import__('zoneinfo').ZoneInfo("UTC")))
    tickers_mentioned: list[str] = Field(default_factory=list, description="Extracted ticker symbols")
    raw_sentiment: float | None = None  # Filled later by sentiment engine

class MentionVelocity(BaseModel):
    """Tracks mention frequency for watchlist triggering."""
    ticker: str
    window_minutes: int = 60
    mention_count: int
    rolling_mean: float
    rolling_std: float
    z_score: float
    triggered: bool = Field(default=False, description="True if z_score > 3.0")
```

---

## 3. RSS Feed Scraper

```python
import feedparser
from datetime import datetime
import zoneinfo

UTC = zoneinfo.ZoneInfo("UTC")

RSS_FEEDS: dict[str, str] = {
    "moneycontrol": "https://www.moneycontrol.com/rss/latestnews.xml",
    "economic_times": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
    "livemint": "https://www.livemint.com/rss/markets",
    "business_standard": "https://www.business-standard.com/rss/markets-106.rss",
}

def scrape_rss(source_name: str, url: str) -> list[NewsItem]:
    """Parse an RSS feed into NewsItem objects."""
    feed = feedparser.parse(url)
    items = []
    for entry in feed.entries:
        published = datetime(*entry.published_parsed[:6], tzinfo=UTC)
        items.append(NewsItem(
            source=NewsSource(source_name),
            tier=NewsTier.NEWS,
            title=entry.get("title", ""),
            body=entry.get("summary", ""),
            url=entry.get("link", ""),
            published_at=published,
        ))
    return items
```

---

## 4. Reddit Scraping with PRAW

```python
import praw

def create_reddit_client() -> praw.Reddit:
    """
    Create a Reddit API client.
    Requires a free Reddit app: https://www.reddit.com/prefs/apps

    Store credentials in environment variables:
      REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT
    """
    import os
    return praw.Reddit(
        client_id=os.environ["REDDIT_CLIENT_ID"],
        client_secret=os.environ["REDDIT_CLIENT_SECRET"],
        user_agent=os.environ.get("REDDIT_USER_AGENT", "quant-sim/1.0"),
    )

def scrape_subreddit(
    reddit: praw.Reddit,
    subreddit_name: str,
    limit: int = 100,
) -> list[NewsItem]:
    """Scrape recent posts from an Indian finance subreddit."""
    subreddit = reddit.subreddit(subreddit_name)
    items = []
    for post in subreddit.new(limit=limit):
        items.append(NewsItem(
            source=NewsSource.REDDIT_ISB if "streetbets" in subreddit_name.lower()
                   else NewsSource.REDDIT_II,
            tier=NewsTier.SOCIAL,
            title=post.title,
            body=post.selftext[:2000],  # Truncate long posts
            url=f"https://reddit.com{post.permalink}",
            published_at=datetime.fromtimestamp(post.created_utc, tz=UTC),
        ))
    return items
```

---

## 5. Mention Velocity & Watchlist Triggering

A ticker enters the dynamic watchlist when its social/news mention count
exceeds a **3x rolling z-score** above its baseline.

```python
import numpy as np
from collections import defaultdict, deque

class MentionTracker:
    """Track ticker mention velocity with rolling z-score detection."""

    def __init__(self, window_size: int = 24, threshold_z: float = 3.0):
        """
        Args:
            window_size: Number of time buckets for rolling stats.
            threshold_z: Z-score threshold for watchlist triggering.
        """
        self._window_size = window_size
        self._threshold_z = threshold_z
        self._history: dict[str, deque[int]] = defaultdict(
            lambda: deque([0] * window_size, maxlen=window_size)
        )
        self._current_counts: dict[str, int] = defaultdict(int)

    def record_mention(self, ticker: str) -> None:
        self._current_counts[ticker] += 1

    def flush_bucket(self) -> list[MentionVelocity]:
        """
        Call at the end of each time bucket (e.g., hourly).
        Pushes current counts into history and computes z-scores.
        """
        results = []
        all_tickers = set(self._current_counts.keys()) | set(self._history.keys())

        for ticker in all_tickers:
            count = self._current_counts.get(ticker, 0)
            self._history[ticker].append(count)

            history_arr = np.array(self._history[ticker])
            mean = float(np.mean(history_arr))
            std = float(np.std(history_arr))
            z = (count - mean) / std if std > 0 else 0.0

            results.append(MentionVelocity(
                ticker=ticker,
                window_minutes=60,
                mention_count=count,
                rolling_mean=mean,
                rolling_std=std,
                z_score=z,
                triggered=z > self._threshold_z,
            ))

        self._current_counts.clear()
        return results
```

---

## 6. Point-in-Time Alignment Rules

> **CRITICAL**: News events must be aligned to the **next candle open**, never
> the current or previous candle. This prevents look-ahead bias.

1. When a `NewsItem` arrives at timestamp `t_news`:
   - Find the next price bar with `open_timestamp > t_news`
   - The news feature becomes available **only at that bar's timestamp**
2. News arriving after market close (15:30 IST) maps to the **next trading day's open**
3. Weekend/holiday news maps to the next trading session's open
4. Store the `published_at` alongside the `effective_at` (mapped bar timestamp) in telemetry

For implementation patterns, see the `look-ahead-bias-prevention` skill.

---

## 7. Rate Limiting & Compliance

| Source | Rate Limit | Compliance |
|---|---|---|
| RSS feeds | 1 request per 5 minutes per feed | Standard; respect `Cache-Control` headers |
| Reddit PRAW | 60 requests/minute (OAuth) | Must register app at reddit.com/prefs/apps |
| NSE website | Aggressive anti-bot; use delays ≥ 5s | Set realistic `User-Agent`; do not hammer |
| StockTwits | 200 requests/hour (free) | API key required for higher limits |

---

## 8. Deduplication

News items must be deduplicated by `(source, url)` or `(source, title_hash)`.
Use a TTL-bounded set (e.g., 72-hour window) to avoid storing unbounded history.

```python
import hashlib

def news_fingerprint(item: NewsItem) -> str:
    """Generate dedup key for a news item."""
    raw = f"{item.source.value}:{item.url or item.title}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]
```

---

## 9. Dependencies

```toml
feedparser = ">=6.0"
praw = ">=7.7"
httpx = ">=0.27"
pydantic = ">=2.7"
numpy = ">=1.26"
```
