# Indian Financial News Sources Reference

## Tier 1 — Official / Regulatory (Highest Signal)

### NSE Corporate Filings
- **URL**: `https://www.nseindia.com/companies-listing/corporate-filings-announcements`
- **Data**: Board meetings, earnings results, splits, buybacks, rights issues
- **Format**: HTML table, paginated
- **Anti-bot**: Aggressive; requires realistic headers, session cookies, delays ≥ 5s
- **Best approach**: Use `httpx` with browser-like headers and IST timezone handling

### BSE Announcements
- **URL**: `https://www.bseindia.com/corporates/ann.html`
- **Data**: Regulatory filings, corporate actions, insider trading
- **Format**: HTML/AJAX
- **Notes**: BSE API is more scraping-friendly than NSE

### SEBI Orders & Circulars
- **URL**: `https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=1`
- **Data**: Enforcement actions, policy changes, new regulations
- **Impact**: Can affect entire sectors (e.g., mutual fund regulations, FPI rules)

---

## Tier 2 — Professional Financial News

### MoneyControl
- **RSS Feed**: `https://www.moneycontrol.com/rss/latestnews.xml`
- **Other feeds**:
  - Markets: `https://www.moneycontrol.com/rss/marketreports.xml`
  - Business: `https://www.moneycontrol.com/rss/business.xml`
  - Companies: `https://www.moneycontrol.com/rss/companies.xml`
- **Notes**: India's largest financial portal. RSS is the cleanest access method.

### Economic Times Markets
- **RSS Feed**: `https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms`
- **Other feeds**:
  - Stocks: `https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms`
  - IPO: `https://economictimes.indiatimes.com/markets/ipos/fpos/rssfeeds/17994756.cms`
- **Notes**: Bennett Coleman (Times of India group). Good earnings coverage.

### LiveMint
- **RSS Feed**: `https://www.livemint.com/rss/markets`
- **Other feeds**:
  - Companies: `https://www.livemint.com/rss/companies`
  - Economy: `https://www.livemint.com/rss/economy`
- **Notes**: HT Media publication. Strong macro/policy coverage.

### Business Standard
- **RSS Feed**: `https://www.business-standard.com/rss/markets-106.rss`
- **Other feeds**:
  - Companies: `https://www.business-standard.com/rss/companies-101.rss`
  - Economy: `https://www.business-standard.com/rss/economy-102.rss`

---

## Tier 3 — Social / Retail Chatter

### Reddit — r/IndianStreetBets
- **URL**: `https://www.reddit.com/r/IndianStreetBets/`
- **API**: PRAW (Python Reddit API Wrapper)
- **Character**: Meme-heavy, options-focused, high noise, high volume
- **Signal**: Useful for retail sentiment velocity, not directional accuracy
- **Setup**: Register app at `https://www.reddit.com/prefs/apps` → "script" type

### Reddit — r/IndiaInvestments
- **URL**: `https://www.reddit.com/r/IndiaInvestments/`
- **Character**: More conservative, long-term investment focus
- **Signal**: Higher quality discussion, lower volume

### StockTwits
- **API**: `https://api.stocktwits.com/api/2/`
- **Endpoints**:
  - `/streams/symbol/{symbol}.json` — Posts for a symbol
  - `/streams/trending.json` — Trending stocks
- **Rate Limit**: 200 requests/hour (free tier), 400/hour (partner)
- **Notes**: Symbol format differs; may need mapping for Indian stocks

---

## Rate Limiting Guidelines

| Source | Recommended Interval | Notes |
|---|---|---|
| RSS feeds | 5 minutes between requests per feed | Respect `Cache-Control` |
| NSE website | ≥ 5 seconds between requests | Anti-bot detection |
| BSE website | ≥ 3 seconds between requests | Moderate anti-bot |
| Reddit PRAW | 60 requests/minute (automatic with PRAW) | OAuth required |
| StockTwits API | ~3 requests/minute to stay safe | API key optional |

---

## Scraping Best Practices

1. **Always set a realistic User-Agent** — e.g., `Mozilla/5.0 (Windows NT 10.0; Win64; x64)`
2. **Respect robots.txt** — Check before scraping any new domain
3. **Use RSS when available** — Preferred over HTML scraping
4. **Cache aggressively** — Same URL within 5 minutes = use cache
5. **Handle IST timestamps** — Indian sources report in IST; always convert to UTC internally
6. **Monitor for changes** — RSS feed URLs and HTML structures change periodically
