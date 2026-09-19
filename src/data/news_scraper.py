"""
Free Financial News & Social Chatter Ingestion Engine for Indian Equities.

Scrapes and normalizes alternative financial text data from 100% free public sources:
- Tier 1: NSE/BSE Corporate Filings & Regulatory Announcements
- Tier 2: Major Indian Financial Portals via RSS
  (Moneycontrol, Economic Times, LiveMint, Business Standard)
- Tier 3: Retail Social Sentiment from Reddit
  (r/IndianStreetBets & r/IndiaInvestments via public JSON API)

Features:
1. Zero paid API credentials required.
2. SHA-256 fingerprinting for robust deduplication.
3. Automatic Entity Resolution (NER) to map mentions to canonical NSE tickers.
4. Deterministic synthetic news generator for offline backtesting.
"""

import hashlib
import html
import logging
import re
from collections.abc import Iterable
from datetime import UTC, date, datetime, timedelta
from typing import Any, Final

import feedparser
import httpx

from .calendar import is_trading_day
from .entity_mapper import EntityMapper, default_entity_mapper
from .schemas import NewsArticle

logger = logging.getLogger("news-scraper")

# Public RSS feeds for Indian financial news
DEFAULT_RSS_FEEDS: Final[dict[str, str]] = {
    "moneycontrol": "https://www.moneycontrol.com/rss/latestnews.xml",
    "economic_times": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
    "livemint": "https://www.livemint.com/rss/markets",
    "business_standard": "https://www.business-standard.com/rss/markets-106.rss",
}

# Free public Reddit endpoints
DEFAULT_SUBREDDITS: Final[list[str]] = [
    "IndianStreetBets",
    "IndiaInvestments",
]

DEFAULT_USER_AGENT: Final[str] = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36 "
    "(QuantTradingResearch/1.0; mailto:research@portfolio.ai)"
)

HTML_CLEANR: Final[re.Pattern[str]] = re.compile(r"<.*?>|&([a-z0-9]+|#[0-9]{1,6}|#x[0-9a-f]{1,6});")


def clean_html_text(raw_html: str) -> str:
    """Strip HTML tags and unescape HTML entities from feed summaries."""
    if not raw_html:
        return ""
    text = html.unescape(raw_html)
    cleaned = re.sub(r"<[^>]+>", " ", text)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def compute_article_fingerprint(source: str, identifier: str) -> str:
    """Generate SHA-256 fingerprint for deduplicating news items."""
    raw = f"{source.strip().lower()}:{identifier.strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def parse_feed_datetime(entry: Any) -> datetime:
    """Extract and normalize publication datetime to UTC from feed entry."""
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        tm = entry.published_parsed
        return datetime(
            int(tm[0]), int(tm[1]), int(tm[2]), int(tm[3]), int(tm[4]), int(tm[5]), tzinfo=UTC
        )
    if hasattr(entry, "updated_parsed") and entry.updated_parsed:
        tm = entry.updated_parsed
        return datetime(
            int(tm[0]), int(tm[1]), int(tm[2]), int(tm[3]), int(tm[4]), int(tm[5]), tzinfo=UTC
        )
    return datetime.now(tz=UTC)


def scrape_rss_feed(
    source_name: str,
    feed_url: str,
    mapper: EntityMapper | None = None,
    client: httpx.Client | None = None,
) -> list[NewsArticle]:
    """
    Fetch and parse an RSS feed into validated NewsArticle domain models.
    """
    entity_resolver = mapper or default_entity_mapper
    headers = {"User-Agent": DEFAULT_USER_AGENT}

    try:
        if client:
            resp = client.get(feed_url, headers=headers, timeout=10.0)
            feed_content = resp.text
            parsed = feedparser.parse(feed_content)
        else:
            with httpx.Client(timeout=10.0) as default_client:
                resp = default_client.get(feed_url, headers=headers)
                parsed = feedparser.parse(resp.text)
    except Exception as e:
        logger.warning(f"Error fetching RSS feed from {source_name} ({feed_url}): {e}")
        return []

    articles: list[NewsArticle] = []

    for entry in getattr(parsed, "entries", []):
        raw_title = getattr(entry, "title", "")
        clean_title = clean_html_text(raw_title)
        if not clean_title:
            continue

        raw_summary = getattr(entry, "summary", "") or getattr(entry, "description", "")
        clean_body = clean_html_text(raw_summary)

        url = getattr(entry, "link", "")
        published_at = parse_feed_datetime(entry)

        # Generate unique article ID
        dedup_id = compute_article_fingerprint(source_name, url or clean_title)
        article_id = f"{source_name.upper()}_{dedup_id}"

        # Resolve primary and mentioned tickers
        primary_ticker, mentioned = entity_resolver.map_article(clean_title, clean_body)

        articles.append(
            NewsArticle(
                article_id=article_id,
                ticker=primary_ticker,
                title=clean_title,
                content=clean_body,
                published_at=published_at,
                source=source_name,
                url=url if url else None,
                tier="news",
                tickers_mentioned=mentioned,
            )
        )

    return articles


def scrape_reddit_public(
    subreddit: str = "IndianStreetBets",
    limit: int = 50,
    mapper: EntityMapper | None = None,
    client: httpx.Client | None = None,
) -> list[NewsArticle]:
    """
    Scrape recent discussions from Indian finance subreddits using free public JSON feeds.
    Requires no paid Reddit credentials or OAuth keys.
    """
    entity_resolver = mapper or default_entity_mapper
    url = f"https://www.reddit.com/r/{subreddit}/new.json?limit={limit}"
    headers = {"User-Agent": DEFAULT_USER_AGENT}

    try:
        if client:
            resp = client.get(url, headers=headers, timeout=10.0)
            data = resp.json()
        else:
            with httpx.Client(timeout=10.0) as default_client:
                resp = default_client.get(url, headers=headers)
                data = resp.json()
    except Exception as e:
        logger.warning(f"Error scraping Reddit r/{subreddit}: {e}")
        return []

    articles: list[NewsArticle] = []
    children = data.get("data", {}).get("children", [])

    for post in children:
        pdata = post.get("data", {})
        post_id = pdata.get("id", "")
        title = clean_html_text(pdata.get("title", ""))
        selftext = clean_html_text(pdata.get("selftext", ""))

        if not title:
            continue

        created_utc = pdata.get("created_utc", 0.0)
        published_at = (
            datetime.fromtimestamp(created_utc, tz=UTC) if created_utc > 0 else datetime.now(tz=UTC)
        )

        permalink = pdata.get("permalink", "")
        post_url = f"https://reddit.com{permalink}" if permalink else None

        source_name = f"reddit_{subreddit.lower()}"
        if post_id:
            article_id = f"REDDIT_{post_id}"
        else:
            article_id = f"REDDIT_{compute_article_fingerprint(source_name, title)}"

        # Resolve primary and mentioned tickers
        primary_ticker, mentioned = entity_resolver.map_article(title, selftext)

        articles.append(
            NewsArticle(
                article_id=article_id,
                ticker=primary_ticker,
                title=title,
                content=selftext[:2000],  # Truncate large essays
                published_at=published_at,
                source=source_name,
                url=post_url,
                tier="social",
                tickers_mentioned=mentioned,
            )
        )

    return articles


class NewsScraper:
    """
    High-level news scraping coordinator with in-memory deduplication and caching.
    """

    def __init__(
        self,
        rss_feeds: dict[str, str] | None = None,
        subreddits: list[str] | None = None,
        mapper: EntityMapper | None = None,
    ) -> None:
        self.rss_feeds = rss_feeds or dict(DEFAULT_RSS_FEEDS)
        self.subreddits = subreddits or list(DEFAULT_SUBREDDITS)
        self.mapper = mapper or default_entity_mapper
        self._seen_fingerprints: set[str] = set()

    def scrape_all(self) -> list[NewsArticle]:
        """
        Poll all configured RSS feeds and subreddits, deduplicating in-memory.
        """
        all_articles: list[NewsArticle] = []

        # 1. RSS Feeds
        for source, url in self.rss_feeds.items():
            feed_items = scrape_rss_feed(source, url, mapper=self.mapper)
            for item in feed_items:
                fp = compute_article_fingerprint(item.source, item.url or item.title)
                if fp not in self._seen_fingerprints:
                    self._seen_fingerprints.add(fp)
                    all_articles.append(item)

        # 2. Subreddits
        for sub in self.subreddits:
            reddit_items = scrape_reddit_public(sub, mapper=self.mapper)
            for item in reddit_items:
                fp = compute_article_fingerprint(item.source, item.url or item.title)
                if fp not in self._seen_fingerprints:
                    self._seen_fingerprints.add(fp)
                    all_articles.append(item)

        all_articles.sort(key=lambda a: a.published_at)
        return all_articles

    def clear_cache(self) -> None:
        """Reset deduplication cache."""
        self._seen_fingerprints.clear()


def generate_mock_news_stream(
    tickers: Iterable[str],
    start_date: date,
    end_date: date,
    seed: int = 42,
    density_per_day: int = 3,
) -> list[NewsArticle]:
    """
    Generate deterministic, point-in-time synthetic financial news and social chatter
    for reproducible offline simulation and backtesting.
    """
    import random

    rng = random.Random(seed)
    articles: list[NewsArticle] = []

    # Clean ticker names for headline synthesis
    ticker_clean = [t.replace(".NS", "").replace(".BO", "") for t in tickers]

    headline_templates: list[tuple[str, str, str]] = [
        # (title_template, source, tier)
        ("{t} Q{q} Net Profit surges {p}% YoY, beats Street estimates", "moneycontrol", "news"),
        ("{t} board approves interim dividend of Rs {d} per share", "economic_times", "official"),
        ("SEBI issues clarification on {t} disclosure norms", "nse_filing", "official"),
        ("Morgan Stanley upgrades {t} to Overweight with target Rs {tgt}", "livemint", "news"),
        ("Why is {t} down today? Breakout or breakdown?", "reddit_indianstreetbets", "social"),
        ("{t} secures mega infrastructure contract worth Rs {val} cr", "business_standard", "news"),
        ("FII inflows drive rally in {t} and banking heavyweights", "moneycontrol", "news"),
        ("Big options build-up seen in {t} 270 CE strike", "reddit_indianstreetbets", "social"),
    ]

    curr_date = start_date
    article_idx = 1

    while curr_date <= end_date:
        # Determine how many articles publish today
        count = density_per_day if is_trading_day(curr_date) else max(1, density_per_day // 2)

        for _ in range(count):
            sym = rng.choice(ticker_clean)
            canonical = f"{sym}.NS"
            tpl, source, tier = rng.choice(headline_templates)

            # Generate realistic intraday publication hours (UTC)
            # 03:00 to 14:00 UTC corresponds to 08:30 to 19:30 IST
            hour = rng.randint(3, 14)
            minute = rng.randint(0, 59)
            second = rng.randint(0, 59)

            pub_ts = datetime(
                curr_date.year, curr_date.month, curr_date.day, hour, minute, second, tzinfo=UTC
            )

            title = tpl.format(
                t=sym,
                q=rng.randint(1, 4),
                p=rng.randint(5, 45),
                d=rng.randint(2, 25),
                tgt=rng.randint(200, 3500),
                val=rng.randint(500, 15000),
            )

            body = (
                f"Detailed market update regarding {sym}. Further institutional details provided."
            )

            articles.append(
                NewsArticle(
                    article_id=f"MOCK_{article_idx:05d}",
                    ticker=canonical,
                    title=title,
                    content=body,
                    published_at=pub_ts,
                    source=source,
                    url=f"https://portfolio.ai/mock-news/{article_idx}",
                    tier=tier,  # type: ignore[arg-type]
                    tickers_mentioned=[canonical],
                )
            )
            article_idx += 1

        curr_date += timedelta(days=1)

    articles.sort(key=lambda a: a.published_at)
    return articles
