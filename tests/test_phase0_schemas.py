"""
Unit tests verifying Phase 0 bootstrap and Pydantic v2 domain schemas.
"""

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from src.data.schemas import (
    Order,
    PriceBar,
    SentimentFeatureVector,
    SentimentScore,
    Trade,
)


def test_price_bar_validation() -> None:
    now = datetime.now(UTC)
    bar = PriceBar(
        timestamp=now,
        ticker="POWERGRID.NS",
        open=269.95,
        high=274.05,
        low=268.35,
        close=269.10,
        volume=11421380.0,
    )
    assert bar.ticker == "POWERGRID.NS"
    assert bar.close == 269.10

    # Immutability check (frozen=True)
    with pytest.raises(ValidationError):
        bar.close = 270.0  # type: ignore[misc]

    # Extra field forbidden check (extra="forbid")
    with pytest.raises(ValidationError):
        PriceBar(
            timestamp=now,
            ticker="ONGC.NS",
            open=232.0,
            high=235.0,
            low=231.0,
            close=232.5,
            volume=1000.0,
            unexpected_field="invalid",  # type: ignore[call-arg]
        )


def test_order_and_trade_lifecycle() -> None:
    now = datetime.now(UTC)
    order = Order(
        order_id="ORD_001",
        ticker="ONGC.NS",
        side="BUY",
        quantity=500,
        order_type="MARKET",
        timestamp=now,
    )
    assert order.side == "BUY"
    assert order.quantity == 500

    trade = Trade(
        trade_id="TRD_001",
        order_id=order.order_id,
        ticker=order.ticker,
        side=order.side,
        quantity=order.quantity,
        execution_price=232.50,
        slippage=0.05,
        fee=12.50,
        timestamp=now,
    )
    assert trade.execution_price == 232.50
    assert trade.fee == 12.50


def test_sentiment_schemas() -> None:
    now = datetime.now(UTC)
    sentiment = SentimentScore(
        score=-0.62,
        positive_prob=0.10,
        negative_prob=0.72,
        neutral_prob=0.18,
        confidence=0.82,
        timestamp=now,
    )
    assert sentiment.score == -0.62
    assert sentiment.negative_prob == 0.72

    vec = SentimentFeatureVector(
        ticker="ONGC.NS",
        timestamp=now,
        raw_score=sentiment.score,
        score_24h_delta=-0.35,
        mention_velocity_z=3.4,
        confidence=sentiment.confidence,
    )
    assert vec.mention_velocity_z == 3.4
