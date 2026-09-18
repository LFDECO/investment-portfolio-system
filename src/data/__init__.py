"""
Data ingestion, normalization, calendar management, and Pydantic domain schemas.
"""

from .calendar import (
    INTRADAY_SQUARE_OFF_TIME,
    IST,
    MARKET_CLOSE_TIME,
    MARKET_OPEN_TIME,
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
from .price_fetcher import (
    fetch_historical_daily,
    fetch_intraday_bars,
    fetch_liquid_universe,
    fetch_ohlcv,
    generate_mock_bars,
    normalize_ticker,
    validate_candlestick,
)
from .schemas import (
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
    "SentimentScore",
    "SentimentFeatureVector",
    "Order",
    "Trade",
    "Position",
    "PortfolioState",
    # Calendar & Timezones
    "IST",
    "UTC",
    "PRE_OPEN_TIME",
    "MARKET_OPEN_TIME",
    "INTRADAY_SQUARE_OFF_TIME",
    "MARKET_CLOSE_TIME",
    "NSE_HOLIDAYS",
    "is_trading_day",
    "is_market_hours",
    "to_utc",
    "to_ist",
    "get_trading_days",
    "get_next_trading_day",
    "get_next_market_open",
    "NSETradingCalendar",
    # Price Fetcher
    "normalize_ticker",
    "validate_candlestick",
    "fetch_ohlcv",
    "fetch_historical_daily",
    "fetch_intraday_bars",
    "fetch_liquid_universe",
    "generate_mock_bars",
    # Data Queue
    "TimestampedEvent",
    "DataAlignmentQueue",
]
