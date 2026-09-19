"""
High-Precision Entity Resolution and Ticker Mapping Engine for Indian Equities.

Maps mentions of companies, aliases, acronyms, brand names, and slang in unstructured
English financial headlines and social chatter to canonical NSE exchange tickers (e.g. TICKER.NS).

Enforces longest-phrase-first matching with strict word boundaries to avoid common
sub-token false positives (e.g. matching "IT" from "ITC", or "ON" from "ONGC").
"""

import re
from typing import Final

# Comprehensive canonical mapping for Indian Equities & Major Indices
ENTITY_TO_TICKER: Final[dict[str, str]] = {
    # Banking & Financial Services
    "State Bank of India": "SBIN.NS",
    "State Bank": "SBIN.NS",
    "SBI": "SBIN.NS",
    "SBIN": "SBIN.NS",
    "HDFC Bank Limited": "HDFCBANK.NS",
    "HDFC Bank": "HDFCBANK.NS",
    "HDFCBANK": "HDFCBANK.NS",
    "HDFC": "HDFCBANK.NS",
    "ICICI Bank Limited": "ICICIBANK.NS",
    "ICICI Bank": "ICICIBANK.NS",
    "ICICIBANK": "ICICIBANK.NS",
    "ICICI": "ICICIBANK.NS",
    "Kotak Mahindra Bank": "KOTAKBANK.NS",
    "Kotak Bank": "KOTAKBANK.NS",
    "KOTAKBANK": "KOTAKBANK.NS",
    "Kotak": "KOTAKBANK.NS",
    "Axis Bank Limited": "AXISBANK.NS",
    "Axis Bank": "AXISBANK.NS",
    "AXISBANK": "AXISBANK.NS",
    "Axis": "AXISBANK.NS",
    "IndusInd Bank": "INDUSINDBK.NS",
    "Indusind": "INDUSINDBK.NS",
    "Punjab National Bank": "PNB.NS",
    "PNB": "PNB.NS",
    "Bank of Baroda": "BANKBARODA.NS",
    "Bank of Maharashtra": "MAHABANK.NS",
    "Yes Bank Limited": "YESBANK.NS",
    "Yes Bank": "YESBANK.NS",
    "Bajaj Finance Limited": "BAJFINANCE.NS",
    "Bajaj Finance": "BAJFINANCE.NS",
    "BAJFINANCE": "BAJFINANCE.NS",
    "Bajaj Finserv Limited": "BAJAJFINSV.NS",
    "Bajaj Finserv": "BAJAJFINSV.NS",
    "Jio Financial Services": "JIOFIN.NS",
    "Jio Financial": "JIOFIN.NS",
    "Jio Finance": "JIOFIN.NS",
    "JIOFIN": "JIOFIN.NS",
    # Energy & Utilities
    "Power Grid Corporation of India": "POWERGRID.NS",
    "Power Grid Corporation": "POWERGRID.NS",
    "Power Grid Corp": "POWERGRID.NS",
    "Power Grid": "POWERGRID.NS",
    "Powergrid": "POWERGRID.NS",
    "POWERGRID": "POWERGRID.NS",
    "Oil and Natural Gas Corporation": "ONGC.NS",
    "Oil & Natural Gas Corporation": "ONGC.NS",
    "ONGC": "ONGC.NS",
    "NTPC Limited": "NTPC.NS",
    "NTPC": "NTPC.NS",
    "Coal India Limited": "COALINDIA.NS",
    "Coal India": "COALINDIA.NS",
    "COALINDIA": "COALINDIA.NS",
    "Tata Power Company": "TATAPOWER.NS",
    "Tata Power": "TATAPOWER.NS",
    "Adani Power Limited": "ADANIPOWER.NS",
    "Adani Power": "ADANIPOWER.NS",
    "Suzlon Energy": "SUZLON.NS",
    "Suzlon": "SUZLON.NS",
    "Rural Electrification Corporation": "RECLTD.NS",
    "REC Limited": "RECLTD.NS",
    "REC Ltd": "RECLTD.NS",
    "RECLTD": "RECLTD.NS",
    "REC": "RECLTD.NS",
    "Power Finance Corporation": "PFC.NS",
    "PFC": "PFC.NS",
    # Information Technology
    "Tata Consultancy Services": "TCS.NS",
    "TCS": "TCS.NS",
    "Infosys Limited": "INFY.NS",
    "Infosys Technologies": "INFY.NS",
    "Infosys": "INFY.NS",
    "Infy": "INFY.NS",
    "INFY": "INFY.NS",
    "Wipro Limited": "WIPRO.NS",
    "Wipro": "WIPRO.NS",
    "HCL Technologies": "HCLTECH.NS",
    "HCL Tech": "HCLTECH.NS",
    "HCLTECH": "HCLTECH.NS",
    "Tech Mahindra Limited": "TECHM.NS",
    "Tech Mahindra": "TECHM.NS",
    "TechM": "TECHM.NS",
    "L&T Technology Services": "LTTS.NS",
    # Conglomerates & Industrial
    "Reliance Industries Limited": "RELIANCE.NS",
    "Reliance Industries": "RELIANCE.NS",
    "Reliance Ind": "RELIANCE.NS",
    "Reliance": "RELIANCE.NS",
    "RIL": "RELIANCE.NS",
    "Larsen & Toubro": "LT.NS",
    "Larsen and Toubro": "LT.NS",
    "L&T": "LT.NS",
    "Adani Enterprises Limited": "ADANIENT.NS",
    "Adani Enterprises": "ADANIENT.NS",
    "ADANIENT": "ADANIENT.NS",
    "Adani Ports and Special Economic Zone": "ADANIPORTS.NS",
    "Adani Ports & SEZ": "ADANIPORTS.NS",
    "Adani Ports": "ADANIPORTS.NS",
    "ADANIPORTS": "ADANIPORTS.NS",
    # Metals & Mining
    "Tata Steel Limited": "TATASTEEL.NS",
    "Tata Steel": "TATASTEEL.NS",
    "TATASTEEL": "TATASTEEL.NS",
    "JSW Steel Limited": "JSWSTEEL.NS",
    "JSW Steel": "JSWSTEEL.NS",
    "Hindalco Industries": "HINDALCO.NS",
    "Hindalco": "HINDALCO.NS",
    "Vedanta Limited": "VEDL.NS",
    "Vedanta": "VEDL.NS",
    # Automobiles
    "Tata Motors Commercial": "TMPV.NS",
    "Tata Motors Limited": "TMPV.NS",
    "Tata Motors": "TMPV.NS",
    "TATAMOTORS": "TMPV.NS",
    "TMPV": "TMPV.NS",
    "Maruti Suzuki India": "MARUTI.NS",
    "Maruti Suzuki": "MARUTI.NS",
    "Maruti": "MARUTI.NS",
    "Mahindra & Mahindra": "M&M.NS",
    "Mahindra and Mahindra": "M&M.NS",
    "M&M": "M&M.NS",
    "Hero MotoCorp": "HEROMOTOCO.NS",
    "Hero Honda": "HEROMOTOCO.NS",
    "Hero Moto": "HEROMOTOCO.NS",
    "Eicher Motors": "EICHERMOT.NS",
    "Royal Enfield": "EICHERMOT.NS",
    "Bajaj Auto": "BAJAJ-AUTO.NS",
    # Consumer Goods & Retail
    "ITC Limited": "ITC.NS",
    "ITC Ltd": "ITC.NS",
    "ITC": "ITC.NS",
    "Hindustan Unilever Limited": "HINDUNILVR.NS",
    "Hindustan Unilever": "HINDUNILVR.NS",
    "HUL": "HINDUNILVR.NS",
    "Tata Consumer Products": "TATACONSUM.NS",
    "Tata Consumer": "TATACONSUM.NS",
    "Titan Company": "TITAN.NS",
    "Titan": "TITAN.NS",
    "Asian Paints Limited": "ASIANPAINT.NS",
    "Asian Paints": "ASIANPAINT.NS",
    "Asian Paint": "ASIANPAINT.NS",
    "Nestle India": "NESTLEIND.NS",
    "Britannia Industries": "BRITANNIA.NS",
    "Britannia": "BRITANNIA.NS",
    "Dabur India": "DABUR.NS",
    "Dabur": "DABUR.NS",
    "Godrej Consumer Products": "GODREJCP.NS",
    "Godrej Consumer": "GODREJCP.NS",
    "Trent Limited": "TRENT.NS",
    "Trent": "TRENT.NS",
    # Pharmaceuticals
    "Sun Pharmaceutical": "SUNPHARMA.NS",
    "Sun Pharma": "SUNPHARMA.NS",
    "Cipla Limited": "CIPLA.NS",
    "Cipla": "CIPLA.NS",
    "Dr Reddy's Laboratories": "DRREDDY.NS",
    "Dr. Reddy's": "DRREDDY.NS",
    "Dr Reddy": "DRREDDY.NS",
    "DRREDDY": "DRREDDY.NS",
    "Divi's Laboratories": "DIVISLAB.NS",
    "Divis Lab": "DIVISLAB.NS",
    "Apollo Hospitals": "APOLLOHOSP.NS",
    "Apollo Hospital": "APOLLOHOSP.NS",
    # Telecommunications & Media
    "Bharti Airtel": "BHARTIARTL.NS",
    "Airtel": "BHARTIARTL.NS",
    "BHARTIARTL": "BHARTIARTL.NS",
    "Vodafone Idea": "IDEA.NS",
    # Infrastructure, Real Estate & Defense
    "UltraTech Cement": "ULTRACEMCO.NS",
    "UltraTech": "ULTRACEMCO.NS",
    "Grasim Industries": "GRASIM.NS",
    "Grasim": "GRASIM.NS",
    "DLF Limited": "DLF.NS",
    "DLF": "DLF.NS",
    "Bharat Heavy Electricals": "BHEL.NS",
    "BHEL": "BHEL.NS",
    "Bharat Electronics Limited": "BEL.NS",
    "Bharat Electronics": "BEL.NS",
    "BEL": "BEL.NS",
    "Hindustan Aeronautics Limited": "HAL.NS",
    "Hindustan Aeronautics": "HAL.NS",
    "HAL": "HAL.NS",
    "Indian Railway Catering and Tourism Corporation": "IRCTC.NS",
    "IRCTC": "IRCTC.NS",
    "Indian Railway Finance Corporation": "IRFC.NS",
    "IRFC": "IRFC.NS",
    # New-Age Tech & Consumer Internet
    "Zomato Limited": "ETERNAL.NS",
    "Zomato": "ETERNAL.NS",
    "Eternal Limited": "ETERNAL.NS",
    "Eternal": "ETERNAL.NS",
    "ETERNAL": "ETERNAL.NS",
    "One97 Communications": "PAYTM.NS",
    "Paytm": "PAYTM.NS",
    "FSN E-Commerce Ventures": "NYKAA.NS",
    "Nykaa": "NYKAA.NS",
    "PB Fintech": "POLICYBZR.NS",
    "PolicyBazaar": "POLICYBZR.NS",
    "Policybazaar": "POLICYBZR.NS",
    # Market Indices
    "Nifty 50": "^NSEI",
    "NIFTY 50": "^NSEI",
    "NSE Nifty": "^NSEI",
    "Nifty": "^NSEI",
    "BSE Sensex": "^BSESN",
    "Sensex": "^BSESN",
    "BSE 30": "^BSESN",
    "Bank Nifty": "^NSEBANK",
    "Nifty Bank": "^NSEBANK",
    "India VIX": "^INDIAVIX",
    "India Volatility Index": "^INDIAVIX",
}

# Generic words that require strict casing or context to avoid false positives
STRICT_CASE_ENTITIES: Final[set[str]] = {
    "IT",
    "ON",
    "CAN",
    "FOR",
    "NOW",
    "BE",
    "BEL",
    "HAL",
    "REC",
    "SBI",
    "TCS",
    "RIL",
    "ITC",
    "PFC",
    "M&M",
    "DLF",
    "BHEL",
    "IRFC",
    "IRCTC",
}


class EntityMapper:
    """
    High-precision entity recognition and ticker mapping for Indian equities.

    Features:
    1. Longest-phrase matching first (e.g. 'Tata Motors' matches before 'Tata').
    2. Word boundary (\b) tokenization to prevent sub-string false positives.
    3. Handles $-prefixed tickers (e.g. $RELIANCE, $INFY, $TCS).
    4. Casing sensitivity for short acronyms ('ITC' vs generic words).
    """

    def __init__(self, custom_mapping: dict[str, str] | None = None) -> None:
        self.mapping = dict(ENTITY_TO_TICKER)
        if custom_mapping:
            self.mapping.update(custom_mapping)

        # Sort alias phrases strictly by length descending (longest match first)
        self._sorted_aliases: list[str] = sorted(
            self.mapping.keys(), key=lambda k: (-len(k), k.lower())
        )

        # Pre-compile regex patterns for high-speed scanning
        # Escapes special characters like & and .
        self._patterns: list[tuple[re.Pattern[str], str, bool]] = []
        for alias in self._sorted_aliases:
            ticker = self.mapping[alias]
            is_strict = alias in STRICT_CASE_ENTITIES
            escaped = re.escape(alias)
            # Match either the plain word boundary or with leading $
            pattern_str = rf"(?:\$)?\b{escaped}\b"
            flags = 0 if is_strict else re.IGNORECASE
            self._patterns.append((re.compile(pattern_str, flags), ticker, is_strict))

    def resolve_ticker(self, entity_str: str) -> str | None:
        """
        Direct exact or normalized lookup of an entity string to its canonical ticker.
        """
        clean = entity_str.strip()
        if clean in self.mapping:
            return self.mapping[clean]

        for alias, ticker in self.mapping.items():
            if alias.lower() == clean.lower():
                return ticker

        # If already in canonical TICKER.NS form
        if clean.upper().endswith(".NS") or clean.upper().endswith(".BO"):
            return clean.upper()

        return None

    def extract_tickers(self, text: str) -> list[str]:
        """
        Scan unstructured text and extract all matched canonical ticker symbols
        in order of first appearance, with duplicates removed.
        """
        if not text:
            return []

        # Track match spans to ensure shorter substrings don't match within longer matches
        matched_spans: list[tuple[int, int]] = []
        found: list[tuple[int, str]] = []  # (start_index, ticker)

        for pattern, ticker, _ in self._patterns:
            for match in pattern.finditer(text):
                start, end = match.span()

                # Check if this span overlaps with an already matched longer phrase
                overlaps = any(
                    max(start, m_start) < min(end, m_end) for m_start, m_end in matched_spans
                )
                if not overlaps:
                    matched_spans.append((start, end))
                    found.append((start, ticker))

        # Sort matches by first appearance index in text
        found.sort(key=lambda x: x[0])

        # Deduplicate while preserving order
        seen: set[str] = set()
        deduped: list[str] = []
        for _, ticker in found:
            if ticker not in seen:
                seen.add(ticker)
                deduped.append(ticker)

        return deduped

    def map_article(self, title: str, content: str = "") -> tuple[str | None, list[str]]:
        """
        Map a news article or social post to its primary ticker and all mentioned tickers.
        Title mentions take priority for primary ticker assignment.
        """
        title_tickers = self.extract_tickers(title)
        body_tickers = self.extract_tickers(content) if content else []

        all_mentioned: list[str] = []
        for t in title_tickers + body_tickers:
            if t not in all_mentioned:
                all_mentioned.append(t)

        primary_ticker = (
            title_tickers[0] if title_tickers else (body_tickers[0] if body_tickers else None)
        )
        return primary_ticker, all_mentioned


# Default global mapper singleton
default_entity_mapper: Final[EntityMapper] = EntityMapper()


def extract_tickers(text: str) -> list[str]:
    """Convenience function to extract canonical tickers using default mapper."""
    return default_entity_mapper.extract_tickers(text)


def resolve_ticker(entity_name: str) -> str | None:
    """Convenience function to resolve an entity name to a canonical ticker."""
    return default_entity_mapper.resolve_ticker(entity_name)
