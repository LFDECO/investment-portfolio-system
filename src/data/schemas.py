"""
Pydantic v2 Domain Data Models for Quantitative Trading Simulation.
Strict typing and immutability enforced for zero-leakage data integrity.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictSchema(BaseModel):
    """Base immutable schema with strict validation and no extra fields."""

    model_config = ConfigDict(
        strict=True,
        frozen=True,
        extra="forbid",
        validate_default=True,
    )


class PriceBar(StrictSchema):
    """Point-in-time OHLCV price bar."""

    timestamp: datetime
    ticker: str = Field(..., min_length=1, max_length=20)
    open: float = Field(..., gt=0)
    high: float = Field(..., gt=0)
    low: float = Field(..., gt=0)
    close: float = Field(..., gt=0)
    volume: float = Field(..., ge=0)


class NewsArticle(StrictSchema):
    """Financial news item or social post."""

    article_id: str = Field(..., min_length=1)
    ticker: str | None = None
    title: str = Field(..., min_length=1)
    content: str = ""
    published_at: datetime
    source: str = Field(..., min_length=1)
    url: str | None = None
    tier: Literal["official", "news", "social"] = "news"
    tickers_mentioned: list[str] = Field(default_factory=list)
    raw_sentiment: float | None = None


class MentionVelocity(StrictSchema):
    """
    Rolling mention velocity metrics for an asset.
    Used for 3-sigma chatter surge detection and dynamic watchlist inclusion.
    """

    ticker: str = Field(..., min_length=1, max_length=20)
    timestamp: datetime
    window_hours: int = 168  # 7-day rolling window
    current_count: int = Field(..., ge=0)
    rolling_mean: float = Field(..., ge=0.0)
    rolling_std: float = Field(..., ge=0.0)
    z_score: float
    triggered: bool = False


class CorporateAction(StrictSchema):
    """
    Explicit corporate action event (stock split, bonus, cash dividend).
    Propagated through DataAlignmentQueue to adjust positions on ex-date.
    """

    action_id: str = Field(..., min_length=1)
    ticker: str = Field(..., min_length=1, max_length=20)
    action_type: Literal["SPLIT", "BONUS", "DIVIDEND", "RIGHTS"]
    ex_date: datetime
    ratio: str | None = None
    multiplier: float = Field(1.0, gt=0.0)
    dividend_amount: float | None = Field(default=None, ge=0.0)


class SentimentScore(StrictSchema):
    """Raw FinBERT sentiment scoring output."""

    score: float = Field(..., ge=-1.0, le=1.0)
    positive_prob: float = Field(..., ge=0.0, le=1.0)
    negative_prob: float = Field(..., ge=0.0, le=1.0)
    neutral_prob: float = Field(..., ge=0.0, le=1.0)
    confidence: float = Field(..., ge=0.0, le=1.0)
    timestamp: datetime


class SentimentFeatureVector(StrictSchema):
    """Assembled point-in-time sentiment features for agent observation."""

    ticker: str = Field(..., min_length=1, max_length=20)
    timestamp: datetime
    raw_score: float = Field(..., ge=-1.0, le=1.0)
    score_24h_delta: float
    mention_velocity_z: float
    confidence: float = Field(..., ge=0.0, le=1.0)


class Order(StrictSchema):
    """Trade order submitted by a strategy agent."""

    order_id: str = Field(..., min_length=1)
    ticker: str = Field(..., min_length=1, max_length=20)
    side: Literal["BUY", "SELL"]
    quantity: int = Field(..., gt=0)
    order_type: Literal["MARKET", "LIMIT"] = "MARKET"
    limit_price: float | None = None
    timestamp: datetime


class Trade(StrictSchema):
    """Executed trade fill inside the simulation environment."""

    trade_id: str = Field(..., min_length=1)
    order_id: str = Field(..., min_length=1)
    ticker: str = Field(..., min_length=1, max_length=20)
    side: Literal["BUY", "SELL"]
    quantity: int = Field(..., gt=0)
    execution_price: float = Field(..., gt=0)
    slippage: float = Field(0.0, ge=0.0)
    fee: float = Field(0.0, ge=0.0)
    timestamp: datetime


class Position(StrictSchema):
    """Open position in a single asset."""

    ticker: str = Field(..., min_length=1, max_length=20)
    quantity: int = Field(..., ge=0)
    avg_cost: float = Field(..., ge=0)
    current_price: float = Field(..., ge=0)
    unrealized_pnl: float = 0.0
    realized_pnl: float = 0.0


class PortfolioState(StrictSchema):
    """Complete portfolio account snapshot at timestamp t."""

    timestamp: datetime
    cash: float = Field(..., ge=0)
    holdings_value: float = Field(..., ge=0)
    total_value: float = Field(..., ge=0)
    positions: dict[str, Position] = Field(default_factory=dict)
