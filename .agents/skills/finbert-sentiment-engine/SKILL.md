---
name: finbert-sentiment-engine
description: >-
  Build the financial NLP sentiment scoring pipeline using ProsusAI/finbert
  for English financial text. Use this skill when implementing sentiment
  analysis on news headlines and social posts, performing Named Entity
  Recognition to map Indian company aliases to canonical ticker symbols,
  computing sentiment feature vectors (raw score, 24h delta, chatter
  velocity z-score), or optimizing FinBERT inference for batch processing.
  English text only.
---

# FinBERT Sentiment Engine

This skill covers building the financial NLP pipeline that transforms raw
news/social text into quantitative sentiment features for the trading model.

---

## 1. Model Selection

| Model | HuggingFace ID | Output | Notes |
|---|---|---|---|
| FinBERT | `ProsusAI/finbert` | positive/negative/neutral + confidence | Primary model, English-only |
| FinBERT-tone | `yiyanghkust/finbert-tone` | bullish/bearish/neutral | Alternative, tone-focused |

**Decision**: Use `ProsusAI/finbert` as the primary model. It was trained on
financial communication text and produces three-class sentiment with logit scores
that can be converted to a continuous [-1.0, +1.0] range.

---

## 2. Pipeline Architecture

```
NewsItem → Preprocessor → FinBERT Inference → Score Mapper → Feature Vector
                ↓
         Entity Extractor (NER)
                ↓
         Ticker ← Company Alias Map
```

---

## 3. Pydantic Schemas

```python
from pydantic import BaseModel, Field
from datetime import datetime

class SentimentScore(BaseModel):
    """Sentiment analysis result for a single text item."""
    text_hash: str = Field(..., description="SHA-256 hash of input text (first 16 chars)")
    raw_label: str = Field(..., description="positive, negative, or neutral")
    positive_prob: float = Field(..., ge=0, le=1)
    negative_prob: float = Field(..., ge=0, le=1)
    neutral_prob: float = Field(..., ge=0, le=1)
    continuous_score: float = Field(..., ge=-1, le=1, description="+1 = bullish, -1 = bearish")
    confidence: float = Field(..., ge=0, le=1, description="Max probability across classes")
    timestamp: datetime

class SentimentFeatureVector(BaseModel):
    """Aggregated sentiment features for a ticker at a point in time."""
    ticker: str
    timestamp: datetime
    raw_sentiment: float = Field(..., description="Current weighted sentiment score [-1, +1]")
    sentiment_delta_24h: float = Field(..., description="Change in sentiment over last 24h")
    chatter_velocity_zscore: float = Field(..., description="Z-score of mention velocity")
    news_count_24h: int = Field(default=0, description="Number of news items in last 24h")
    official_news_ratio: float = Field(default=0.0, description="Fraction of Tier 1 official news")
```

---

## 4. FinBERT Inference Pipeline

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import numpy as np

class FinBERTSentimentAnalyzer:
    """
    Financial sentiment analyzer using ProsusAI/finbert.
    Designed for CPU inference with optional GPU acceleration.
    """

    MODEL_ID = "ProsusAI/finbert"
    LABELS = ["positive", "negative", "neutral"]

    def __init__(self, device: str | None = None, batch_size: int = 16):
        """
        Args:
            device: "cuda", "cpu", or None for auto-detect.
            batch_size: Max texts per inference batch.
        """
        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = torch.device(device)
        self.batch_size = batch_size

        self.tokenizer = AutoTokenizer.from_pretrained(self.MODEL_ID)
        self.model = AutoModelForSequenceClassification.from_pretrained(self.MODEL_ID)
        self.model.to(self.device)
        self.model.eval()

    def analyze(self, texts: list[str]) -> list[SentimentScore]:
        """
        Analyze a batch of texts. Returns one SentimentScore per text.

        Args:
            texts: List of English financial text strings (headlines, excerpts).

        Returns:
            List of SentimentScore objects with continuous scores.
        """
        results = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]
            results.extend(self._infer_batch(batch))
        return results

    def _infer_batch(self, texts: list[str]) -> list[SentimentScore]:
        import hashlib
        from datetime import datetime, timezone

        inputs = self.tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt",
        ).to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = torch.softmax(outputs.logits, dim=-1).cpu().numpy()

        scores = []
        for idx, text in enumerate(texts):
            p_pos, p_neg, p_neu = float(probs[idx][0]), float(probs[idx][1]), float(probs[idx][2])

            # Convert to continuous score: positive contributes +, negative contributes -
            continuous = p_pos - p_neg  # Range [-1.0, +1.0]

            label_idx = int(np.argmax(probs[idx]))
            text_hash = hashlib.sha256(text.encode()).hexdigest()[:16]

            scores.append(SentimentScore(
                text_hash=text_hash,
                raw_label=self.LABELS[label_idx],
                positive_prob=p_pos,
                negative_prob=p_neg,
                neutral_prob=p_neu,
                continuous_score=continuous,
                confidence=float(np.max(probs[idx])),
                timestamp=datetime.now(tz=timezone.utc),
            ))
        return scores

    def score_single(self, text: str) -> SentimentScore:
        """Convenience method for single-text inference."""
        return self.analyze([text])[0]
```

---

## 5. Indian Company NER & Alias Mapping

```python
import re

# Comprehensive alias → canonical ticker mapping for NIFTY 50 + popular stocks
INDIAN_COMPANY_ALIASES: dict[str, str] = {
    # Exact matches (case-insensitive)
    "reliance": "RELIANCE.NS",
    "reliance industries": "RELIANCE.NS",
    "ril": "RELIANCE.NS",
    "tcs": "TCS.NS",
    "tata consultancy": "TCS.NS",
    "tata consultancy services": "TCS.NS",
    "infosys": "INFY.NS",
    "infy": "INFY.NS",
    "hdfc bank": "HDFCBANK.NS",
    "hdfcbank": "HDFCBANK.NS",
    "icici bank": "ICICIBANK.NS",
    "icicibank": "ICICIBANK.NS",
    "itc": "ITC.NS",
    "bharti airtel": "BHARTIARTL.NS",
    "airtel": "BHARTIARTL.NS",
    "sbi": "SBIN.NS",
    "state bank of india": "SBIN.NS",
    "state bank": "SBIN.NS",
    "wipro": "WIPRO.NS",
    "hindustan unilever": "HINDUNILVR.NS",
    "hul": "HINDUNILVR.NS",
    "kotak mahindra": "KOTAKBANK.NS",
    "kotak bank": "KOTAKBANK.NS",
    "kotak": "KOTAKBANK.NS",
    "larsen & toubro": "LT.NS",
    "larsen and toubro": "LT.NS",
    "l&t": "LT.NS",
    "asian paints": "ASIANPAINT.NS",
    "maruti": "MARUTI.NS",
    "maruti suzuki": "MARUTI.NS",
    "sun pharma": "SUNPHARMA.NS",
    "sun pharmaceutical": "SUNPHARMA.NS",
    "tata steel": "TATASTEEL.NS",
    "tata motors": "TATAMOTORS.NS",
    "axis bank": "AXISBANK.NS",
    "bajaj finance": "BAJFINANCE.NS",
    "bajaj finserv": "BAJAJFINSV.NS",
    "power grid": "POWERGRID.NS",
    "ntpc": "NTPC.NS",
    "adani enterprises": "ADANIENT.NS",
    "adani ports": "ADANIPORTS.NS",
    "tech mahindra": "TECHM.NS",
    "hcl tech": "HCLTECH.NS",
    "hcl technologies": "HCLTECH.NS",
    "ultra tech cement": "ULTRACEMCO.NS",
    "ultratech": "ULTRACEMCO.NS",
    "titan": "TITAN.NS",
    "titan company": "TITAN.NS",
    "nestle india": "NESTLEIND.NS",
    "nestle": "NESTLEIND.NS",
    "divis lab": "DIVISLAB.NS",
    "divi's laboratories": "DIVISLAB.NS",
    "bajaj auto": "BAJAJ-AUTO.NS",
    "cipla": "CIPLA.NS",
    "dr reddy": "DRREDDY.NS",
    "dr reddy's": "DRREDDY.NS",
    "grasim": "GRASIM.NS",
    "grasim industries": "GRASIM.NS",
    "eicher motors": "EICHERMOT.NS",
    "hero motocorp": "HEROMOTOCO.NS",
    "hero": "HEROMOTOCO.NS",
    "m&m": "M&M.NS",
    "mahindra": "M&M.NS",
    "mahindra and mahindra": "M&M.NS",
}

def extract_tickers(text: str) -> list[str]:
    """
    Extract Indian stock tickers from text using alias matching.

    Returns deduplicated list of canonical tickers (e.g., ["RELIANCE.NS", "TCS.NS"]).
    """
    text_lower = text.lower()
    found = set()

    # Sort aliases by length (longest first) to match "tata consultancy services" before "tata"
    sorted_aliases = sorted(INDIAN_COMPANY_ALIASES.keys(), key=len, reverse=True)

    for alias in sorted_aliases:
        # Word boundary match to avoid partial matches
        pattern = r'\b' + re.escape(alias) + r'\b'
        if re.search(pattern, text_lower):
            found.add(INDIAN_COMPANY_ALIASES[alias])

    return sorted(found)
```

---

## 6. Noise Filtering — Tier-Based Weighting

Not all news is equally informative. Weight sentiment by source tier:

```python
TIER_WEIGHTS = {
    "official": 1.0,    # SEBI filings, NSE announcements, earnings
    "news": 0.7,        # MoneyControl, ET, LiveMint
    "social": 0.3,      # Reddit, StockTwits
}

def weighted_sentiment(scores: list[tuple[float, str]]) -> float:
    """
    Compute tier-weighted average sentiment.

    Args:
        scores: List of (continuous_score, tier) tuples.

    Returns:
        Weighted average sentiment in [-1.0, +1.0].
    """
    if not scores:
        return 0.0
    total_weight = sum(TIER_WEIGHTS.get(tier, 0.5) for _, tier in scores)
    weighted_sum = sum(score * TIER_WEIGHTS.get(tier, 0.5) for score, tier in scores)
    return weighted_sum / total_weight if total_weight > 0 else 0.0
```

---

## 7. Feature Vector Assembly

```python
def build_sentiment_features(
    ticker: str,
    current_scores: list[SentimentScore],
    prior_24h_scores: list[SentimentScore],
    chatter_z_score: float,
    tier_labels: list[str],
    timestamp: datetime,
) -> SentimentFeatureVector:
    """
    Assemble the final sentiment feature vector for model consumption.

    This vector contains:
    - raw_sentiment: Tier-weighted average of current window
    - sentiment_delta_24h: Change from prior 24h window
    - chatter_velocity_zscore: From MentionTracker
    """
    current_pairs = [
        (s.continuous_score, t) for s, t in zip(current_scores, tier_labels)
    ]
    prior_pairs = [
        (s.continuous_score, "news") for s in prior_24h_scores
    ]

    current_sentiment = weighted_sentiment(current_pairs)
    prior_sentiment = weighted_sentiment(prior_pairs) if prior_pairs else 0.0

    official_count = sum(1 for t in tier_labels if t == "official")

    return SentimentFeatureVector(
        ticker=ticker,
        timestamp=timestamp,
        raw_sentiment=current_sentiment,
        sentiment_delta_24h=current_sentiment - prior_sentiment,
        chatter_velocity_zscore=chatter_z_score,
        news_count_24h=len(current_scores) + len(prior_24h_scores),
        official_news_ratio=official_count / len(tier_labels) if tier_labels else 0.0,
    )
```

---

## 8. Performance Optimization

- **Batch inference**: Always use `analyze(batch)` over `score_single()` in loops
- **CPU fallback**: FinBERT base is ~440MB; runs acceptably on CPU for batch sizes ≤ 32
- **Model caching**: Load the model once at startup; reuse across the pipeline lifetime
- **Text truncation**: FinBERT max input is 512 tokens; truncate to ~400 words for safety
- **Headline-only mode**: For high throughput, score only headlines (skip article bodies)

---

## 9. Dependencies

```toml
transformers = ">=4.40"
torch = ">=2.2"
pydantic = ">=2.7"
numpy = ">=1.26"
```

> **Note**: `torch` is large (~2GB). For CPU-only, install with:
> `uv pip install torch --index-url https://download.pytorch.org/whl/cpu`
