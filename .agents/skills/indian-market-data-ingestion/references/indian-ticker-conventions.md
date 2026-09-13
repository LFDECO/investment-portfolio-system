# Indian Ticker Conventions Reference

## NSE (National Stock Exchange) — Suffix `.NS`

| Company | NSE Symbol | yfinance Ticker |
|---|---|---|
| Reliance Industries | RELIANCE | `RELIANCE.NS` |
| Tata Consultancy Services | TCS | `TCS.NS` |
| Infosys | INFY | `INFY.NS` |
| HDFC Bank | HDFCBANK | `HDFCBANK.NS` |
| ICICI Bank | ICICIBANK | `ICICIBANK.NS` |
| ITC | ITC | `ITC.NS` |
| Bharti Airtel | BHARTIARTL | `BHARTIARTL.NS` |
| State Bank of India | SBIN | `SBIN.NS` |
| Wipro | WIPRO | `WIPRO.NS` |
| Hindustan Unilever | HINDUNILVR | `HINDUNILVR.NS` |
| Kotak Mahindra Bank | KOTAKBANK | `KOTAKBANK.NS` |
| Larsen & Toubro | LT | `LT.NS` |
| Asian Paints | ASIANPAINT | `ASIANPAINT.NS` |
| Maruti Suzuki | MARUTI | `MARUTI.NS` |
| Sun Pharma | SUNPHARMA | `SUNPHARMA.NS` |
| Tata Steel | TATASTEEL | `TATASTEEL.NS` |
| Tata Motors | TATAMOTORS | `TATAMOTORS.NS` |
| Axis Bank | AXISBANK | `AXISBANK.NS` |
| Power Grid | POWERGRID | `POWERGRID.NS` |
| Bajaj Finance | BAJFINANCE | `BAJFINANCE.NS` |

## BSE (Bombay Stock Exchange) — Suffix `.BO`

BSE uses numeric scrip codes OR text symbols.

| Company | BSE Code | yfinance Ticker |
|---|---|---|
| Reliance Industries | 500325 | `500325.BO` or `RELIANCE.BO` |
| TCS | 532540 | `TCS.BO` |
| Infosys | 500209 | `INFY.BO` |
| HDFC Bank | 500180 | `HDFCBANK.BO` |

## Index Tickers

| Index | yfinance Symbol |
|---|---|
| NIFTY 50 | `^NSEI` |
| SENSEX | `^BSESN` |
| NIFTY Bank | `^NSEBANK` |
| NIFTY IT | `^CNXIT` |
| NIFTY Midcap 50 | `NIFTYMIDCAP50.NS` |

## Common Aliases → Canonical Mapping

Many news headlines use informal names. The NER/entity mapper must handle:

| Informal Name | Canonical Ticker |
|---|---|
| "Reliance" | `RELIANCE.NS` |
| "RIL" | `RELIANCE.NS` |
| "TCS" | `TCS.NS` |
| "Infy" | `INFY.NS` |
| "HDFC" | `HDFCBANK.NS` (context-dependent — could also be HDFC Life, HDFC AMC) |
| "SBI" | `SBIN.NS` |
| "Tata Motors" | `TATAMOTORS.NS` |
| "Tata Steel" | `TATASTEEL.NS` |
| "Airtel" | `BHARTIARTL.NS` |
| "HUL" | `HINDUNILVR.NS` |
| "Kotak" | `KOTAKBANK.NS` |
| "L&T" | `LT.NS` |
| "Bajaj Finance" | `BAJFINANCE.NS` |
| "Maruti" | `MARUTI.NS` |

## Market Hours (IST)

| Session | IST Time | UTC Time |
|---|---|---|
| Pre-open | 09:00 – 09:15 | 03:30 – 03:45 |
| Normal Trading | 09:15 – 15:30 | 03:45 – 10:00 |
| Closing Session | 15:30 – 15:40 | 10:00 – 10:10 |
| Post-close | 15:40 – 16:00 | 10:10 – 10:30 |

## yfinance Interval Limitations

| Interval | Max Lookback |
|---|---|
| `1m` | 7 days |
| `2m`, `5m`, `15m` | 60 days |
| `1h` | 730 days |
| `1d`, `1wk`, `1mo` | Max available history |

## NSE Holiday Calendar

Fetch annually from NSE website. Key holidays (approximate):
- Republic Day (Jan 26)
- Holi (March)
- Good Friday (March/April)
- Ram Navami (March/April)
- Mahavir Jayanti (April)
- Dr. Ambedkar Jayanti (April 14)
- May Day (May 1, some years)
- Independence Day (Aug 15)
- Ganesh Chaturthi (Aug/Sep)
- Mahatma Gandhi Jayanti (Oct 2)
- Dussehra (Oct)
- Diwali (Laxmi Puja, Oct/Nov) — **Muhurat Trading session only**
- Guru Nanak Jayanti (Nov)
- Christmas (Dec 25)
