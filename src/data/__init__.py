"""
Data ingestion, normalization, calendar management, and Pydantic domain schemas.
"""

from .calendar import (
    INTRADAY_SQUARE_OFF_TIME,
    IST,
    MARKET_CLOSE_TIME,
    MARKET_OPEN_TIME,
    MAX_COVERED_YEAR,
    MIN_COVERED_YEAR,
    NSE_HOLIDAYS,
    PRE_OPEN_TIME,
    UTC,
    NSETradingCalendar,
    get_next_market_open,
    get_next_trading_day,
    get_trading_days,
    is_market_hours,
    is_trading_day,
    to_ist,
    to_utc,
)
from .data_queue import (
    DataAlignmentQueue,
    TimestampedEvent,
)
from .entity_mapper import (
    EntityMapper,
    default_entity_mapper,
    extract_tickers,
    resolve_ticker,
)
from .fast_buffer import (
    FastBarBuffer,
    FastBarTuple,
)
from .mention_tracker import (
    DEFAULT_MIN_MENTIONS,
    DEFAULT_THRESHOLD_Z,
    DEFAULT_WINDOW_HOURS,
    MentionTracker,
    compute_historical_mention_velocities,
)
from .news_scraper import (
    DEFAULT_RSS_FEEDS,
    DEFAULT_SUBREDDITS,
    NewsScraper,
    compute_article_fingerprint,
    generate_mock_news_stream,
    scrape_reddit_public,
    scrape_rss_feed,
)
from .price_fetcher import (
    CACHE_DIR,
    detect_price_discontinuities,
    fetch_historical_daily,
    fetch_intraday_bars,
    fetch_liquid_universe,
    fetch_ohlcv,
    generate_mock_bars,
    normalize_ticker,
    validate_candlestick,
)
from .schemas import (
    CorporateAction,
    MentionVelocity,
    NewsArticle,
    Order,
    PortfolioState,
    Position,
    PriceBar,
    SentimentFeatureVector,
    SentimentScore,
    StrictSchema,
    Trade,
)

__all__ = [
    # Schemas
    "StrictSchema",
    "PriceBar",
    "NewsArticle",
    "MentionVelocity",
    "CorporateAction",
    "SentimentScore",
    "SentimentFeatureVector",
    "Order",
    "Trade",
    "Position",
    "PortfolioState",
    # Fast Execution Buffer
    "FastBarBuffer",
    "FastBarTuple",
    # Calendar & Timezones
    "IST",
    "UTC",
    "PRE_OPEN_TIME",
    "MARKET_OPEN_TIME",
    "INTRADAY_SQUARE_OFF_TIME",
    "MARKET_CLOSE_TIME",
    "MIN_COVERED_YEAR",
    "MAX_COVERED_YEAR",
    "NSE_HOLIDAYS",
    "is_trading_day",
    "is_market_hours",
    "to_utc",
    "to_ist",
    "get_trading_days",
    "get_next_trading_day",
    "get_next_market_open",
    "NSETradingCalendar",
    # Price Fetcher & Cache
    "CACHE_DIR",
    "normalize_ticker",
    "validate_candlestick",
    "detect_price_discontinuities",
    "fetch_ohlcv",
    "fetch_historical_daily",
    "fetch_intraday_bars",
    "fetch_liquid_universe",
    "generate_mock_bars",
    # Data Queue
    "TimestampedEvent",
    "DataAlignmentQueue",
    # Entity Mapper
    "EntityMapper",
    "default_entity_mapper",
    "extract_tickers",
    "resolve_ticker",
    # News Scraper
    "DEFAULT_RSS_FEEDS",
    "DEFAULT_SUBREDDITS",
    "NewsScraper",
    "scrape_rss_feed",
    "scrape_reddit_public",
    "compute_article_fingerprint",
    "generate_mock_news_stream",
    # Mention Velocity
    "DEFAULT_WINDOW_HOURS",
    "DEFAULT_THRESHOLD_Z",
    "DEFAULT_MIN_MENTIONS",
    "MentionTracker",
    "compute_historical_mention_velocities",
]
