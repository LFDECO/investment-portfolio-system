import axios from "axios";
import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, NextFunction, Request, Response } from "express";
import mysql from "mysql2/promise";
import { sdk } from "./sdk";
import { ENV } from "./env";

type AuthState = {
  userId: number;
  email: string;
  name: string;
};

type QuoteSnapshot = {
  price: number;
  previousClose: number | null;
  change: number;
  changePercent: number;
  volume: number | null;
  marketState: string | null;
  marketTime: number | null;
  currency: string | null;
};

type HistoricalPoint = {
  time: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

const DEFAULT_MARKET_SYMBOLS = [
  "RELIANCE.NS",
  "TCS.NS",
  "INFY.NS",
  "HDFCBANK.NS",
  "ICICIBANK.NS",
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "NVDA",
];

export const NIFTY_LIQUID_UNIVERSE = [
  { symbol: "RELIANCE.NS", name: "Reliance Industries Ltd" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services Ltd" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank Ltd" },
  { symbol: "INFY.NS", name: "Infosys Ltd" },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank Ltd" },
  { symbol: "BHARTIARTL.NS", name: "Bharti Airtel Ltd" },
  { symbol: "SBIN.NS", name: "State Bank of India" },
  { symbol: "ITC.NS", name: "ITC Ltd" },
  { symbol: "LT.NS", name: "Larsen & Toubro Ltd" },
  { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever Ltd" },
  { symbol: "BAJFINANCE.NS", name: "Bajaj Finance Ltd" },
  { symbol: "MARUTI.NS", name: "Maruti Suzuki India Ltd" },
  { symbol: "M&M.NS", name: "Mahindra & Mahindra Ltd" },
  { symbol: "SUNPHARMA.NS", name: "Sun Pharmaceutical Industries Ltd" },
  { symbol: "TITAN.NS", name: "Titan Company Ltd" },
  { symbol: "ADANIENT.NS", name: "Adani Enterprises Ltd" },
  { symbol: "ADANIPORTS.NS", name: "Adani Ports and Special Economic Zone Ltd" },
  { symbol: "ULTRACEMCO.NS", name: "UltraTech Cement Ltd" },
  { symbol: "AXISBANK.NS", name: "Axis Bank Ltd" },
  { symbol: "KOTAKBANK.NS", name: "Kotak Mahindra Bank Ltd" },
  { symbol: "NTPC.NS", name: "NTPC Ltd" },
  { symbol: "ONGC.NS", name: "Oil & Natural Gas Corporation Ltd" },
  { symbol: "POWERGRID.NS", name: "Power Grid Corporation of India Ltd" },
  { symbol: "TATASTEEL.NS", name: "Tata Steel Ltd" },
  { symbol: "TMPV.NS", name: "Tata Motors Passenger Vehicles Ltd" },
  { symbol: "JSWSTEEL.NS", name: "JSW Steel Ltd" },
  { symbol: "COALINDIA.NS", name: "Coal India Ltd" },
  { symbol: "CIPLA.NS", name: "Cipla Ltd" },
  { symbol: "TECHM.NS", name: "Tech Mahindra Ltd" },
  { symbol: "HCLTECH.NS", name: "HCL Technologies Ltd" },
  { symbol: "DRREDDY.NS", name: "Dr. Reddy's Laboratories Ltd" },
  { symbol: "GRASIM.NS", name: "Grasim Industries Ltd" },
  { symbol: "EICHERMOT.NS", name: "Eicher Motors Ltd" },
  { symbol: "NESTLEIND.NS", name: "Nestle India Ltd" },
  { symbol: "BRITANNIA.NS", name: "Britannia Industries Ltd" },
  { symbol: "APOLLOHOSP.NS", name: "Apollo Hospitals Enterprise Ltd" },
  { symbol: "BPCL.NS", name: "Bharat Petroleum Corporation Ltd" },
  { symbol: "HEROMOTOCO.NS", name: "Hero MotoCorp Ltd" },
  { symbol: "SHREECEM.NS", name: "Shree Cement Ltd" },
  { symbol: "TATACONSUM.NS", name: "Tata Consumer Products Ltd" },
  { symbol: "DIVISLAB.NS", name: "Divi's Laboratories Ltd" },
  { symbol: "SBILIFE.NS", name: "SBI Life Insurance Company Ltd" },
  { symbol: "HDFCLIFE.NS", name: "HDFC Life Insurance Company Ltd" },
  { symbol: "BAJAJFINSV.NS", name: "Bajaj Finserv Ltd" },
  { symbol: "BAJAJ-AUTO.NS", name: "Bajaj Auto Ltd" },
  { symbol: "ASIANPAINT.NS", name: "Asian Paints Ltd" },
  { symbol: "WIPRO.NS", name: "Wipro Ltd" },
  { symbol: "BEL.NS", name: "Bharat Electronics Ltd" },
  { symbol: "TRENT.NS", name: "Trent Ltd" },
  { symbol: "ETERNAL.NS", name: "Eternal Ltd (Zomato)" },
  { symbol: "JIOFIN.NS", name: "Jio Financial Services Ltd" },
  { symbol: "HAL.NS", name: "Hindustan Aeronautics Ltd" },
  { symbol: "VBL.NS", name: "Varun Beverages Ltd" },
  { symbol: "DLF.NS", name: "DLF Ltd" },
  { symbol: "CHOLAFIN.NS", name: "Cholamandalam Investment and Finance Company Ltd" },
  { symbol: "SIEMENS.NS", name: "Siemens Ltd" },
  { symbol: "ABB.NS", name: "ABB India Ltd" },
  { symbol: "PFC.NS", name: "Power Finance Corporation Ltd" },
  { symbol: "RECLTD.NS", name: "REC Ltd" },
  { symbol: "GAIL.NS", name: "GAIL (India) Ltd" },
  { symbol: "BHEL.NS", name: "Bharat Heavy Electricals Ltd" },
  { symbol: "TVSMOTOR.NS", name: "TVS Motor Company Ltd" },
  { symbol: "VEDL.NS", name: "Vedanta Ltd" },
  { symbol: "INDHOTEL.NS", name: "The Indian Hotels Company Ltd" },
  { symbol: "MOTHERSON.NS", name: "Samvardhana Motherson International Ltd" },
  { symbol: "PIDILITIND.NS", name: "Pidilite Industries Ltd" },
  { symbol: "IRCTC.NS", name: "Indian Railway Catering and Tourism Corp Ltd" },
  { symbol: "SUZLON.NS", name: "Suzlon Energy Ltd" },
  { symbol: "IDEA.NS", name: "Vodafone Idea Ltd" },
  { symbol: "YESBANK.NS", name: "Yes Bank Ltd" },
  { symbol: "PNB.NS", name: "Punjab National Bank" },
  { symbol: "BANKBARODA.NS", name: "Bank of Baroda" },
  { symbol: "CANBK.NS", name: "Canara Bank" },
  { symbol: "IDFCFIRSTB.NS", name: "IDFC First Bank Ltd" },
  { symbol: "NHPC.NS", name: "NHPC Ltd" },
  { symbol: "IOB.NS", name: "Indian Overseas Bank" },
  { symbol: "UNIONBANK.NS", name: "Union Bank of India" },
  { symbol: "SAIL.NS", name: "Steel Authority of India Ltd" },
  { symbol: "FEDERALBNK.NS", name: "The Federal Bank Ltd" },
];

const NSE_CORE_SYMBOLS = NIFTY_LIQUID_UNIVERSE.map(item => item.symbol);

export function getIndianMarketStatus(): {
  isOpen: boolean;
  status: "OPEN" | "CLOSED";
  statusText: string;
  badge: "live" | "closed";
  message: string;
  asOf: string;
} {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 3600000 * 5.5);

  const day = ist.getDay(); // 0 = Sun, 6 = Sat
  const hour = ist.getHours();
  const minute = ist.getMinutes();
  const totalMinutes = hour * 60 + minute;

  const isWeekday = day >= 1 && day <= 5;
  const isMarketHours = totalMinutes >= 9 * 60 + 15 && totalMinutes < 15 * 60 + 30;
  const isOpen = isWeekday && isMarketHours;

  const formattedTime = ist.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  if (isOpen) {
    return {
      isOpen: true,
      status: "OPEN",
      statusText: "NSE Live Market",
      badge: "live",
      message: "Market is Open • Live Trading (09:15 - 15:30 IST)",
      asOf: formattedTime,
    };
  }

  return {
    isOpen: false,
    status: "CLOSED",
    statusText: "Market Closed",
    badge: "closed",
    message: "Market Closed • Last Session Close at 15:30 IST",
    asOf: formattedTime,
  };
}
const YAHOO_QUOTE_BATCH_SIZE = 40;
const DEFAULT_USD_INR_RATE = 83;
const NSE_UNIVERSE_URL = "https://archives.nseindia.com/content/equities/EQUITY_L.csv";
let nseUniverseSeeded = false;
let nseUniverseCache: Array<{ symbol: string; name: string }> = [];
let nseUniverseFetchedAt = 0;
const NSE_UNIVERSE_TTL_MS = 1000 * 60 * 60 * 6;

let pool: mysql.Pool | null = null;

function getPool() {
  if (!ENV.databaseUrl) {
    throw new Error("DATABASE_URL is required for portfolio API");
  }
  if (!pool) {
    pool = mysql.createPool({
      uri: ENV.databaseUrl,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function getCookieToken(req: Request): string | null {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const token = cookies[COOKIE_NAME];
  return typeof token === "string" && token.length > 0 ? token : null;
}

function getCandidateTokens(req: Request): string[] {
  const cookieToken = getCookieToken(req);
  const bearerToken = getBearerToken(req);
  return Array.from(new Set([cookieToken, bearerToken].filter(Boolean) as string[]));
}

function normalizeSessionEmail(session: { openId: string; email: string | null }) {
  return session.email ?? `oauth_${session.openId}@portfolio.local`;
}

async function fetchLivePrices(symbols: string[]): Promise<Map<string, number>> {
  const snapshots = await fetchLiveQuoteSnapshots(symbols);
  const map = new Map<string, number>();
  snapshots.forEach((snapshot, symbol) => {
    map.set(symbol, snapshot.price);
  });
  return map;
}

function inferCurrencyFromSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper.endsWith(".NS") || upper.endsWith(".BO")) return "INR";
  return "USD";
}

function convertPriceToInr(price: number, currency: string | null, usdInrRate: number): number {
  if (!Number.isFinite(price)) return price;
  const normalized = (currency ?? "").toUpperCase();
  if (normalized === "INR") return price;
  if (normalized === "USD" || !normalized) return price * usdInrRate;
  return price;
}

interface CachedQuote {
  snapshot: QuoteSnapshot;
  cachedAt: number;
}
const quoteCache = new Map<string, CachedQuote>();
const QUOTE_CACHE_TTL_MS = 20_000; // 20s cache TTL

let cachedUsdInrRate: { rate: number; cachedAt: number } | null = null;
const USD_INR_CACHE_TTL_MS = 60_000 * 5; // 5 min cache TTL

async function fetchUsdInrRate(): Promise<number> {
  const now = Date.now();
  if (cachedUsdInrRate && now - cachedUsdInrRate.cachedAt < USD_INR_CACHE_TTL_MS) {
    return cachedUsdInrRate.rate;
  }
  try {
    const { data } = await axios.get(
      "https://query1.finance.yahoo.com/v8/finance/chart/USDINR=X?range=1d&interval=1d",
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        timeout: 6000,
      }
    );
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (typeof price === "number" && Number.isFinite(price) && price > 0) {
      cachedUsdInrRate = { rate: price, cachedAt: now };
      return price;
    }
  } catch {
    // Fallback constant keeps trading available even if FX lookup fails.
  }
  return DEFAULT_USD_INR_RATE;
}

async function fetchLiveQuoteSnapshots(
  symbols: string[]
): Promise<Map<string, QuoteSnapshot>> {
  const uniqueSymbols = Array.from(new Set(symbols.filter(Boolean)));
  if (uniqueSymbols.length === 0) return new Map();

  const map = new Map<string, QuoteSnapshot>();
  const needed: string[] = [];
  const now = Date.now();

  for (const sym of uniqueSymbols) {
    const cached = quoteCache.get(sym);
    if (cached && now - cached.cachedAt < QUOTE_CACHE_TTL_MS) {
      map.set(sym, cached.snapshot);
    } else {
      needed.push(sym);
    }
  }

  if (needed.length === 0) {
    return map;
  }

  const usdInrRate = await fetchUsdInrRate();
  const queue = [...needed];
  const concurrency = 16;
  const workers = Array.from({ length: concurrency }).map(async () => {
    while (queue.length > 0) {
      const sym = queue.shift();
      if (!sym) break;
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          sym
        )}?range=1d&interval=1d`;
        const { data } = await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          timeout: 4500,
        });
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) continue;

        const price = meta.regularMarketPrice;
        if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
          continue;
        }

        const currencyRaw =
          typeof meta.currency === "string" && meta.currency
            ? meta.currency
            : inferCurrencyFromSymbol(sym);

        const prevClose =
          typeof meta.chartPreviousClose === "number" && Number.isFinite(meta.chartPreviousClose)
            ? meta.chartPreviousClose
            : typeof meta.previousClose === "number" && Number.isFinite(meta.previousClose)
              ? meta.previousClose
              : price;

        const rawChange =
          typeof meta.fulldayChange === "number" && Number.isFinite(meta.fulldayChange)
            ? meta.fulldayChange
            : typeof meta.regularMarketChange === "number" && Number.isFinite(meta.regularMarketChange)
              ? meta.regularMarketChange
              : price - prevClose;

        const rawChangePercent =
          typeof meta.regularMarketChangePercent === "number" && Number.isFinite(meta.regularMarketChangePercent)
            ? meta.regularMarketChangePercent
            : typeof meta.fulldayChangePercent === "number" && Number.isFinite(meta.fulldayChangePercent)
              ? meta.fulldayChangePercent
              : prevClose > 0
                ? ((price - prevClose) / prevClose) * 100
                : 0;

        const effectivePrice = convertPriceToInr(price, currencyRaw, usdInrRate);
        const effectivePrevClose = convertPriceToInr(prevClose, currencyRaw, usdInrRate);
        const effectiveChange = convertPriceToInr(rawChange, currencyRaw, usdInrRate);

        const snapshot: QuoteSnapshot = {
          price: effectivePrice,
          previousClose: effectivePrevClose,
          change: effectiveChange,
          changePercent: rawChangePercent,
          volume: typeof meta.regularMarketVolume === "number" ? meta.regularMarketVolume : null,
          marketState: meta.currentTradingPeriod?.regular ? "REGULAR" : "CLOSED",
          marketTime: typeof meta.regularMarketTime === "number" ? meta.regularMarketTime : null,
          currency: currencyRaw ?? "INR",
        };

        quoteCache.set(sym, { snapshot, cachedAt: Date.now() });
        map.set(sym, snapshot);
      } catch {
        // Individual ticker network failures ignored
      }
    }
  });

  await Promise.all(workers);
  return map;
}

async function resolveTradePriceInInr(symbol: string): Promise<number | null> {
  const snapshots = await fetchLiveQuoteSnapshots([symbol]);
  const liveSnapshot = snapshots.get(symbol);
  if (liveSnapshot?.price && Number.isFinite(liveSnapshot.price) && liveSnapshot.price > 0) {
    return liveSnapshot.price;
  }

  try {
    const history = await fetchHistoricalPrices(symbol, 10);
    const latest = history[history.length - 1];
    if (latest?.close && Number.isFinite(latest.close) && latest.close > 0) {
      const currency = inferCurrencyFromSymbol(symbol);
      const usdInrRate = await fetchUsdInrRate();
      return convertPriceToInr(latest.close, currency, usdInrRate);
    }
  } catch {
    // Ignore and return null below.
  }

  return null;
}

async function ensureAssetForTrade(
  conn: mysql.PoolConnection,
  payload: { assetId: number | null; tickerSymbol: string | null; assetName: string | null }
) {
  if (payload.assetId && payload.assetId > 0) {
    const [rows] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT \`asset_id\`, \`ticker_symbol\` FROM \`asset\` WHERE \`asset_id\` = ? LIMIT 1`,
      [payload.assetId]
    );
    if (rows.length) {
      return {
        assetId: Number(rows[0].asset_id),
        tickerSymbol: String(rows[0].ticker_symbol),
      };
    }
  }

  const ticker = (payload.tickerSymbol ?? "").trim().toUpperCase();
  if (!ticker) {
    throw new Error("Ticker symbol is required");
  }
  const safeTicker = ticker.endsWith(".NS") || ticker.endsWith(".BO") ? ticker : `${ticker}.NS`;
  const name = payload.assetName?.trim() || safeTicker.replace(/\.NS$|\.BO$/, "");

  await conn.execute(
    `
      INSERT INTO \`asset\` (\`asset_name\`, \`ticker_symbol\`)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE \`asset_name\` = VALUES(\`asset_name\`)
    `,
    [name, safeTicker]
  );
  const [rows] = await conn.execute<mysql.RowDataPacket[]>(
    `SELECT \`asset_id\`, \`ticker_symbol\` FROM \`asset\` WHERE \`ticker_symbol\` = ? LIMIT 1`,
    [safeTicker]
  );
  if (!rows.length) {
    throw new Error("Unable to resolve asset for trade");
  }
  return {
    assetId: Number(rows[0].asset_id),
    tickerSymbol: String(rows[0].ticker_symbol),
  };
}

async function enrichMissingQuotesWithHistory(
  symbols: string[],
  quotes: Map<string, QuoteSnapshot>
): Promise<Map<string, QuoteSnapshot>> {
  const merged = new Map(quotes);
  const missing = Array.from(new Set(symbols.filter(Boolean))).filter(
    symbol => {
      const existing = merged.get(symbol);
      return !existing || !existing.price || existing.price === 0;
    }
  );
  if (missing.length === 0) return merged;

  const usdInrRate = await fetchUsdInrRate();
  const capped = missing.slice(0, 120);

  await Promise.all(
    capped.map(async symbol => {
      try {
        const history = await fetchHistoricalPrices(symbol, 10);
        if (!history || !history.length) {
          console.log(`[ENRICHMENT] No history found for ${symbol}`);
          return;
        }

        const latest = history[history.length - 1];
        const prev = history.length > 1 ? history[history.length - 2] : null;
        if (!latest?.close || !Number.isFinite(latest.close)) {
          console.log(`[ENRICHMENT] Invalid latest close for ${symbol}:`, latest?.close);
          return;
        }

        const currency = inferCurrencyFromSymbol(symbol);
        const latestInr = convertPriceToInr(latest.close, currency, usdInrRate);
        const prevInr =
          prev?.close && Number.isFinite(prev.close)
            ? convertPriceToInr(prev.close, currency, usdInrRate)
            : null;
        const change = prevInr !== null ? latestInr - prevInr : 0;
        const changePercent =
          prevInr !== null && prevInr > 0 ? (change / prevInr) * 100 : 0;

        console.log(`[ENRICHMENT] Successfully enriched ${symbol}: price=${latestInr}, currency=${currency}`);
        merged.set(symbol, {
          price: latestInr,
          previousClose: prevInr,
          change,
          changePercent,
          volume: latest.volume ?? null,
          marketState: "CLOSED_FALLBACK",
          marketTime: null,
          currency: "INR",
        });
      } catch (err: any) {
        console.error(`[ENRICHMENT ERROR] for ${symbol}:`, err.message);
        // Keep symbol unresolved if history also fails.
      }
    })
  );

  return merged;
}


async function searchYahooNseSymbols(query: string): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      q
    )}&quotesCount=30&newsCount=0`;
    const { data } = await axios.get(url, { timeout: 8000 });
    const quotes: any[] = Array.isArray(data?.quotes) ? data.quotes : [];
    const symbols: string[] = quotes
      .map((row: any) => String(row?.symbol ?? ""))
      .filter((symbol: string) => symbol.endsWith(".NS") || symbol.endsWith(".BO"));
    return Array.from(new Set(symbols)).slice(0, 20);
  } catch {
    return [];
  }
}

async function seedNseUniverse(conn: mysql.PoolConnection) {
  if (nseUniverseSeeded) return;
  try {
    const { data } = await axios.get(NSE_UNIVERSE_URL, { timeout: 12000 });
    const csv = typeof data === "string" ? data : "";
    const lines = csv.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) return;
    const header = lines[0].split(",");
    const symbolIdx = header.findIndex(h => h.trim().toUpperCase() === "SYMBOL");
    const nameIdx = header.findIndex(h => h.trim().toUpperCase() === "NAME OF COMPANY");
    if (symbolIdx < 0 || nameIdx < 0) return;

    const rows = lines.slice(1, 3001);
    for (const rawLine of rows) {
      const cols = rawLine.split(",");
      const rawSymbol = cols[symbolIdx]?.replace(/"/g, "").trim();
      const rawName = cols[nameIdx]?.replace(/"/g, "").trim();
      if (!rawSymbol || !rawName) continue;
      const symbol = `${rawSymbol}.NS`;
      await conn.execute(
        `
          INSERT INTO \`asset\` (\`asset_name\`, \`ticker_symbol\`)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE \`asset_name\` = VALUES(\`asset_name\`)
        `,
        [rawName, symbol]
      );
    }
    nseUniverseSeeded = true;
  } catch {
    // Best effort seed only.
  }
}

function symbolToSyntheticId(symbol: string): number {
  let hash = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  }
  return (hash % 900000000) + 100000000;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  out.push(current);
  return out;
}

async function getNseUniverseRows(): Promise<Array<{ symbol: string; name: string }>> {
  const now = Date.now();
  if (nseUniverseCache.length > 0 && now - nseUniverseFetchedAt < NSE_UNIVERSE_TTL_MS) {
    return nseUniverseCache;
  }

  const fallback = Array.from(new Set([...NSE_CORE_SYMBOLS, ...DEFAULT_MARKET_SYMBOLS])).map(symbol => ({
    symbol,
    name: symbol.replace(/\.NS$/, ""),
  }));

  try {
    const { data } = await axios.get(NSE_UNIVERSE_URL, { timeout: 12000 });
    const csv = typeof data === "string" ? data : "";
    const lines = csv.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) {
      nseUniverseCache = fallback;
      nseUniverseFetchedAt = now;
      return nseUniverseCache;
    }
    const header = parseCsvLine(lines[0]).map(v => v.trim().toUpperCase());
    const symbolIdx = header.findIndex(h => h === "SYMBOL");
    const nameIdx = header.findIndex(h => h === "NAME OF COMPANY");
    if (symbolIdx < 0 || nameIdx < 0) {
      nseUniverseCache = fallback;
      nseUniverseFetchedAt = now;
      return nseUniverseCache;
    }

    const parsed = lines.slice(1).flatMap(rawLine => {
      const cols = parseCsvLine(rawLine);
      const rawSymbol = (cols[symbolIdx] ?? "").trim();
      const rawName = (cols[nameIdx] ?? "").trim();
      if (!rawSymbol || !rawName) return [];
      return [{ symbol: `${rawSymbol}.NS`, name: rawName }];
    });

    nseUniverseCache = parsed.length > 0 ? parsed : fallback;
    nseUniverseFetchedAt = now;
    return nseUniverseCache;
  } catch {
    nseUniverseCache = fallback;
    nseUniverseFetchedAt = now;
    return nseUniverseCache;
  }
}

function pickUniverseByQuery(
  universe: Array<{ symbol: string; name: string }>,
  query: string,
  limit: number
) {
  const q = query.trim().toLowerCase();
  if (!q) return universe.slice(0, limit);
  return universe
    .filter(row => row.symbol.toLowerCase().includes(q) || row.name.toLowerCase().includes(q))
    .slice(0, limit);
}

async function seedAssetsFromYahoo(
  conn: mysql.PoolConnection,
  symbols: string[]
) {
  const rows = await fetchYahooQuoteRows(symbols);
  for (const row of rows) {
    await conn.execute(
      `
        INSERT INTO \`asset\` (\`asset_name\`, \`ticker_symbol\`)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE \`asset_name\` = VALUES(\`asset_name\`)
      `,
      [row.name, row.symbol]
    );
  }
}

async function getAssetsWithFallback(
  conn: mysql.PoolConnection,
  options: { search: string; limit: number }
) {
  const { search, limit } = options;
  const where = search
    ? `WHERE (\`ticker_symbol\` LIKE ? OR \`asset_name\` LIKE ?)`
    : "";
  const params = search ? [`%${search}%`, `%${search}%`, limit] : [limit];

  const runQuery = async () => {
    const [rows] = await conn.execute<mysql.RowDataPacket[]>(
      `
        SELECT \`asset_id\`, \`asset_name\`, \`ticker_symbol\`
        FROM \`asset\`
        ${where}
        ORDER BY \`ticker_symbol\` ASC
        LIMIT ?
      `,
      params
    );
    return rows;
  };

  let rows = await runQuery();
  if (rows.length > 0) return rows;

  const searchUpper = search.toUpperCase();
  const looksLikeTicker = /^[A-Z0-9.\-]{1,15}$/.test(searchUpper);
  let symbolsToSeed = looksLikeTicker
    ? [searchUpper, `${searchUpper}.NS`]
    : [...DEFAULT_MARKET_SYMBOLS, ...NSE_CORE_SYMBOLS];

  if (search && !looksLikeTicker) {
    const discovered = await searchYahooNseSymbols(search);
    if (discovered.length > 0) {
      symbolsToSeed = discovered;
    }
  }

  await seedAssetsFromYahoo(conn, symbolsToSeed);

  if (search && looksLikeTicker) {
    const guessedNse = searchUpper.endsWith(".NS") ? searchUpper : `${searchUpper}.NS`;
    await conn.execute(
      `
        INSERT INTO \`asset\` (\`asset_name\`, \`ticker_symbol\`)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE \`asset_name\` = VALUES(\`asset_name\`)
      `,
      [searchUpper, guessedNse]
    );
  }

  if (!search) {
    await seedNseUniverse(conn);
    await seedAssetsFromYahoo(conn, NSE_CORE_SYMBOLS);
  }
  rows = await runQuery();
  return rows;
}

async function resolveAssetSnapshot(
  symbol: string
): Promise<QuoteSnapshot | null> {
  const quotes = await fetchLiveQuoteSnapshots([symbol]);
  const direct = quotes.get(symbol);
  if (direct) return direct;

  const enriched = await enrichMissingQuotesWithHistory([symbol], quotes);
  return enriched.get(symbol) ?? null;
}

function getYahooRangeAndIntervalForDays(days: number): { range: string; interval: string } {
  if (days <= 1) return { range: "1d", interval: "5m" }; // 5-minute intraday candles for 1D
  if (days <= 7) return { range: "5d", interval: "15m" }; // 15-minute candles for 1W
  if (days <= 30) return { range: "1mo", interval: "1d" };
  if (days <= 90) return { range: "3mo", interval: "1d" };
  if (days <= 180) return { range: "6mo", interval: "1d" };
  if (days <= 365) return { range: "1y", interval: "1d" };
  return { range: "2y", interval: "1wk" };
}

async function fetchHistoricalPrices(
  symbol: string,
  days: number
): Promise<HistoricalPoint[]> {
  const { range, interval } = getYahooRangeAndIntervalForDays(days);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=${interval}`;

  const { data } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    timeout: 8000,
  });
  const result = data?.chart?.result?.[0];
  const meta = result?.meta;
  const timestamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  if (!Array.isArray(timestamps) || !quote) return [];

  const rows: HistoricalPoint[] = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const ts = timestamps[i];
    let open = quote?.open?.[i];
    let high = quote?.high?.[i];
    let low = quote?.low?.[i];
    let close = quote?.close?.[i];
    const volume = quote?.volume?.[i];

    // Handle unfinalized daily candle where close is null but meta has the latest market price
    if (i === timestamps.length - 1 && (typeof close !== "number" || !Number.isFinite(close))) {
      const metaPrice = meta?.regularMarketPrice;
      if (typeof metaPrice === "number" && Number.isFinite(metaPrice)) {
        close = metaPrice;
        if (typeof open !== "number" || !Number.isFinite(open)) open = metaPrice;
        if (typeof high !== "number" || !Number.isFinite(high)) {
          high = typeof meta?.regularMarketDayHigh === "number" ? meta.regularMarketDayHigh : metaPrice;
        }
        if (typeof low !== "number" || !Number.isFinite(low)) {
          low = typeof meta?.regularMarketDayLow === "number" ? meta.regularMarketDayLow : metaPrice;
        }
      }
    }

    if (
      typeof ts !== "number" ||
      typeof open !== "number" ||
      typeof high !== "number" ||
      typeof low !== "number" ||
      typeof close !== "number"
    ) {
      continue;
    }

    rows.push({
      time: ts, // unix timestamp in seconds for lightweight-charts
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open,
      high,
      low,
      close,
      volume: typeof volume === "number" ? volume : null,
    });
  }

  return rows;
}

async function ensureUserIdByEmail(
  conn: mysql.PoolConnection,
  payload: { email: string; name: string }
) {
  await conn.execute(
    `
      INSERT INTO \`user\` (\`name\`, \`email\`, \`phone\`, \`created_at\`)
      VALUES (?, ?, NULL, NOW())
      ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`)
    `,
    [payload.name, payload.email]
  );

  const [rows] = await conn.execute<mysql.RowDataPacket[]>(
    `SELECT \`user_id\` FROM \`user\` WHERE \`email\` = ? LIMIT 1`,
    [payload.email]
  );

  const userId = Number(rows?.[0]?.user_id ?? 0);
  if (!userId) {
    throw new Error("Unable to resolve user_id from email");
  }
  return userId;
}

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const tokens = getCandidateTokens(req);
    if (tokens.length === 0) {
      res.status(401).json({ error: "Missing authentication token" });
      return;
    }

    let session: Awaited<ReturnType<typeof sdk.verifySession>> = null;
    for (const token of tokens) {
      session = await sdk.verifySession(token);
      if (session) break;
    }

    if (!session) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const resolvedEmail = normalizeSessionEmail(session);

    const conn = await getPool().getConnection();
    try {
      const userId = await ensureUserIdByEmail(conn, {
        email: resolvedEmail,
        name: session.name || resolvedEmail,
      });
      (req as Request & { auth: AuthState }).auth = {
        userId,
        email: resolvedEmail,
        name: session.name || resolvedEmail,
      };
    } finally {
      conn.release();
    }

    next();
  } catch (error) {
    res.status(401).json({ error: "Unauthorized" });
  }
}

function getAuth(req: Request): AuthState {
  return (req as Request & { auth: AuthState }).auth;
}

async function getPortfolioRows(
  conn: mysql.PoolConnection,
  portfolioId: number,
  userId: number
) {
  const [rows] = await conn.execute<mysql.RowDataPacket[]>(
    `
      SELECT
        p.\`portfolio_id\`,
        p.\`total_value\`,
        h.\`asset_id\`,
        h.\`quantity\`,
        h.\`avg_buy_price\`,
        a.\`asset_name\`,
        a.\`ticker_symbol\`
      FROM \`portfolio\` p
      LEFT JOIN \`holding\` h ON p.\`portfolio_id\` = h.\`portfolio_id\`
      LEFT JOIN \`asset\` a ON h.\`asset_id\` = a.\`asset_id\`
      WHERE p.\`portfolio_id\` = ?
        AND p.\`user_id\` = ?
      ORDER BY a.\`ticker_symbol\` ASC
    `,
    [portfolioId, userId]
  );
  return rows;
}

async function buildPortfolioResponse(
  conn: mysql.PoolConnection,
  portfolioId: number,
  userId: number
) {
  const rows = await getPortfolioRows(conn, portfolioId, userId);
  if (!rows.length) {
    return null;
  }

  const symbols = rows
    .map(row => String(row.ticker_symbol || ""))
    .filter(Boolean);
  const prices = await fetchLivePrices(symbols);

  const holdings = rows
    .filter(row => row.asset_id)
    .map(row => {
      const symbol = String(row.ticker_symbol);
      const currentPrice =
        prices.get(symbol) ?? Number(row.avg_buy_price ?? 0);
      const quantity = Number(row.quantity ?? 0);
      const avgBuyPrice = Number(row.avg_buy_price ?? 0);
      return {
        asset_name: String(row.asset_name),
        ticker_symbol: symbol,
        quantity,
        avg_buy_price: avgBuyPrice,
        current_price: currentPrice,
        total_value: quantity * currentPrice,
      };
    });

  const totalValue = holdings.reduce((sum, h) => sum + h.total_value, 0);

  return {
    portfolio_id: Number(rows[0].portfolio_id),
    total_value: totalValue,
    holdings,
  };
}

async function recalcAndPersistPortfolioValue(
  conn: mysql.PoolConnection,
  portfolioId: number,
  userId: number
) {
  const payload = await buildPortfolioResponse(conn, portfolioId, userId);
  if (!payload) {
    throw new Error("Portfolio not found");
  }
  await conn.execute(
    `UPDATE \`portfolio\` SET \`total_value\` = ? WHERE \`portfolio_id\` = ?`,
    [payload.total_value, portfolioId]
  );
  return payload;
}

export function registerSchemaApiRoutes(app: Express) {
  app.get("/api/v1/assets", authMiddleware, async (_req, res) => {
    try {
      const conn = await getPool().getConnection();
      try {
        const [rows] = await conn.execute<mysql.RowDataPacket[]>(
          `SELECT \`asset_id\`, \`asset_name\`, \`ticker_symbol\` FROM \`asset\` ORDER BY \`ticker_symbol\` ASC`
        );
        let quotes = await fetchLiveQuoteSnapshots(
          rows.map(r => String(r.ticker_symbol))
        );
        quotes = await enrichMissingQuotesWithHistory(
          rows.map(r => String(r.ticker_symbol)),
          quotes
        );
        res.json(
          rows.map(row => ({
            asset_id: Number(row.asset_id),
            asset_name: String(row.asset_name),
            ticker_symbol: String(row.ticker_symbol),
            current_price:
              quotes.get(String(row.ticker_symbol))?.price ?? null,
            change:
              quotes.get(String(row.ticker_symbol))?.change ?? null,
            change_percent:
              quotes.get(String(row.ticker_symbol))?.changePercent ?? null,
            volume:
              quotes.get(String(row.ticker_symbol))?.volume ?? null,
          }))
        );
      } finally {
        conn.release();
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to list assets" });
    }
  });

  app.get("/api/v1/market/daily", authMiddleware, async (req, res) => {
    try {
      const search = String(req.query.q ?? "").trim();
      const limitRaw = Number(req.query.limit ?? 100);
      const limit = Number.isFinite(limitRaw)
        ? Math.max(1, Math.min(250, Math.floor(limitRaw)))
        : 100;

      const universe = await getNseUniverseRows();
      const selected = pickUniverseByQuery(universe, search, limit);
      const symbols = selected.map(row => row.symbol);
      let quotes = await fetchLiveQuoteSnapshots(symbols);
      quotes = await enrichMissingQuotesWithHistory(symbols, quotes);

      res.json(
        selected.map(row => {
          const quote = quotes.get(row.symbol);
          return {
            asset_id: symbolToSyntheticId(row.symbol),
            asset_name: row.name,
            ticker_symbol: row.symbol,
            current_price: quote?.price ?? null,
            change: quote?.change ?? 0,
            change_percent: quote?.changePercent ?? 0,
            volume: quote?.volume ?? null,
            market_state: quote?.marketState ?? null,
            market_time: quote?.marketTime ?? null,
            currency: quote?.currency ?? "INR",
          };
        })
      );
    } catch {
      res.status(500).json({ error: "Failed to fetch daily market data" });
    }
  });

  app.get("/api/v1/market/asset/:assetId", authMiddleware, async (req, res) => {
    try {
      const rawParam = String(req.params.assetId ?? "").trim().toUpperCase();
      const assetId = Number(rawParam);
      const tickerFromQuery = String(req.query.ticker_symbol ?? "").trim().toUpperCase();
      const tickerSymbol = tickerFromQuery || (isNaN(assetId) ? rawParam : "");

      const hasAssetId = !isNaN(assetId) && assetId > 0;
      const hasTicker = tickerSymbol.length > 0;

      if (!hasAssetId && !hasTicker) {
        res.status(400).json({ error: "Invalid asset request" });
        return;
      }
      const universe = await getNseUniverseRows();
      const byTicker = tickerSymbol
        ? universe.find(row => row.symbol.toUpperCase() === tickerSymbol)
        : null;
      const byId = !byTicker && hasAssetId
        ? universe.find(row => symbolToSyntheticId(row.symbol) === assetId)
        : null;
      const target = byTicker ?? byId;

      if (!target) {
        res.status(404).json({ error: "Asset not found" });
        return;
      }

      const snapshot = await resolveAssetSnapshot(target.symbol);
      res.json({
        asset_id: symbolToSyntheticId(target.symbol),
        asset_name: target.name,
        ticker_symbol: target.symbol,
        current_price: snapshot?.price ?? null,
        change: snapshot?.change ?? 0,
        change_percent: snapshot?.changePercent ?? 0,
        volume: snapshot?.volume ?? null,
        market_state: snapshot?.marketState ?? null,
        market_time: snapshot?.marketTime ?? null,
        currency: snapshot?.currency ?? "INR",
      });
    } catch {
      res.status(500).json({ error: "Failed to fetch stock snapshot" });
    }
  });

  app.get("/api/v1/market/status", (_req, res) => {
    res.json(getIndianMarketStatus());
  });

  app.get("/api/v1/market/trending", authMiddleware, async (req, res) => {
    try {
      const type = String(req.query.type ?? "gainers").toLowerCase();
      const limitRaw = Number(req.query.limit ?? 20);
      const limit = Number.isFinite(limitRaw)
        ? Math.max(1, Math.min(50, Math.floor(limitRaw)))
        : 20;

      // Use our curated liquid Indian market universe spanning all sectors & letters
      const symbols = NIFTY_LIQUID_UNIVERSE.map(row => row.symbol);
      let quotes = await fetchLiveQuoteSnapshots(symbols);
      quotes = await enrichMissingQuotesWithHistory(symbols, quotes);

      const payload = NIFTY_LIQUID_UNIVERSE.map(row => {
        const quote = quotes.get(row.symbol);
        return {
          asset_id: symbolToSyntheticId(row.symbol),
          asset_name: row.name,
          ticker_symbol: row.symbol,
          current_price: quote?.price ?? null,
          change: quote?.change ?? 0,
          change_percent: quote?.changePercent ?? 0,
          volume: quote?.volume ?? null,
          market_state: quote?.marketState ?? null,
          market_time: quote?.marketTime ?? null,
          currency: quote?.currency ?? "INR",
        };
      }).filter(p => p.current_price !== null && Number.isFinite(p.current_price));

      let sorted = [...payload];
      if (type === "gainers") {
        sorted = sorted.sort((a, b) => b.change_percent - a.change_percent);
      } else if (type === "losers") {
        sorted = sorted.sort((a, b) => a.change_percent - b.change_percent);
      } else if (type === "active") {
        sorted = sorted.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
      }

      res.json(sorted.slice(0, limit));
    } catch {
      res.status(500).json({ error: "Failed to fetch trending stocks" });
    }
  });

  app.get("/api/v1/market/history/:assetId", authMiddleware, async (req, res) => {
    try {
      const rawParam = String(req.params.assetId ?? "").trim().toUpperCase();
      const assetId = Number(rawParam);
      const tickerFromQuery = String(req.query.ticker_symbol ?? "").trim().toUpperCase();
      const tickerSymbol = tickerFromQuery || (isNaN(assetId) ? rawParam : "");
      const daysRaw = Number(req.query.days ?? 30);
      const days = Number.isFinite(daysRaw)
        ? Math.max(1, Math.min(365, Math.floor(daysRaw)))
        : 30;
      const universe = await getNseUniverseRows();
      const byTicker = tickerSymbol
        ? universe.find(row => row.symbol.toUpperCase() === tickerSymbol)
        : null;
      const byId = !byTicker && !isNaN(assetId) && assetId > 0
        ? universe.find(row => symbolToSyntheticId(row.symbol) === assetId)
        : null;
      const target = byTicker ?? byId;

      if (!target) {
        res.status(404).json({ error: "Asset not found" });
        return;
      }

      const history = await fetchHistoricalPrices(target.symbol, days);
      res.json({
        asset_id: symbolToSyntheticId(target.symbol),
        asset_name: target.name,
        ticker_symbol: target.symbol,
        days,
        history,
      });
    } catch {
      res.status(500).json({ error: "Failed to fetch historical market data" });
    }
  });

  app.get("/api/v1/portfolio/default", authMiddleware, async (req, res) => {
    try {
      const { userId } = getAuth(req);
      const conn = await getPool().getConnection();
      try {
        const [rows] = await conn.execute<mysql.RowDataPacket[]>(
          `SELECT \`portfolio_id\` FROM \`portfolio\` WHERE \`user_id\` = ? ORDER BY \`created_at\` ASC LIMIT 1`,
          [userId]
        );

        let portfolioId = Number(rows?.[0]?.portfolio_id ?? 0);

        if (!portfolioId) {
          const [inserted] = await conn.execute<mysql.ResultSetHeader>(
            `
              INSERT INTO \`portfolio\` (\`user_id\`, \`portfolio_name\`, \`created_at\`, \`total_value\`)
              VALUES (?, 'Default Portfolio', NOW(), 0)
            `,
            [userId]
          );
          portfolioId = Number(inserted.insertId);
        }

        const payload = await buildPortfolioResponse(conn, portfolioId, userId);
        res.json(payload ?? { portfolio_id: portfolioId, total_value: 0, holdings: [] });
      } finally {
        conn.release();
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to load default portfolio" });
    }
  });

  app.get("/api/v1/portfolio/:portfolioId", authMiddleware, async (req, res) => {
    try {
      const { userId } = getAuth(req);
      const portfolioId = Number(req.params.portfolioId);
      if (!portfolioId) {
        res.status(400).json({ error: "Invalid portfolio_id" });
        return;
      }

      const conn = await getPool().getConnection();
      try {
        const payload = await buildPortfolioResponse(conn, portfolioId, userId);
        if (!payload) {
          res.status(403).json({ error: "Unauthorized portfolio" });
          return;
        }
        res.json(payload);
      } finally {
        conn.release();
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to load portfolio" });
    }
  });

  app.post("/api/v1/portfolio/:portfolioId/buy", authMiddleware, async (req, res) => {
    const { userId } = getAuth(req);
    const portfolioId = Number(req.params.portfolioId);
    const rawAssetId = Number(req.body?.asset_id);
    const requestTicker = typeof req.body?.ticker_symbol === "string" ? req.body.ticker_symbol : null;
    const requestAssetName = typeof req.body?.asset_name === "string" ? req.body.asset_name : null;
    const quantity = Number(req.body?.quantity);

    if (!portfolioId || !Number.isFinite(quantity) || quantity <= 0) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const conn = await getPool().getConnection();
    try {
      const [portfolioRows] = await conn.execute<mysql.RowDataPacket[]>(
        `SELECT \`portfolio_id\` FROM \`portfolio\` WHERE \`portfolio_id\` = ? AND \`user_id\` = ? LIMIT 1`,
        [portfolioId, userId]
      );
      if (!portfolioRows.length) {
        res.status(403).json({ error: "Unauthorized portfolio" });
        return;
      }

      const resolvedAsset = await ensureAssetForTrade(conn, {
        assetId: Number.isFinite(rawAssetId) && rawAssetId > 0 ? rawAssetId : null,
        tickerSymbol: requestTicker,
        assetName: requestAssetName,
      });
      const assetId = resolvedAsset.assetId;
      const tickerSymbol = resolvedAsset.tickerSymbol;
      const livePrice = await resolveTradePriceInInr(tickerSymbol);
      if (!livePrice || livePrice <= 0) {
        res.status(400).json({ error: "Unable to resolve tradable price" });
        return;
      }

      await conn.beginTransaction();
      try {
        await conn.execute(
          `
            INSERT INTO \`transaction\`
            (\`portfolio_id\`, \`asset_id\`, \`transaction_type\`, \`quantity\`, \`price\`, \`transaction_date\`)
            VALUES (?, ?, 'BUY', ?, ?, CURDATE())
          `,
          [portfolioId, assetId, quantity, livePrice]
        );

        const [holdingRows] = await conn.execute<mysql.RowDataPacket[]>(
          `SELECT \`quantity\`, \`avg_buy_price\` FROM \`holding\` WHERE \`portfolio_id\` = ? AND \`asset_id\` = ? LIMIT 1`,
          [portfolioId, assetId]
        );

        if (holdingRows.length) {
          const oldQty = Number(holdingRows[0].quantity);
          const oldAvg = Number(holdingRows[0].avg_buy_price);
          const newQty = oldQty + quantity;
          const newAvg = (oldQty * oldAvg + quantity * livePrice) / newQty;

          await conn.execute(
            `
              UPDATE \`holding\`
              SET \`quantity\` = ?, \`avg_buy_price\` = ?
              WHERE \`portfolio_id\` = ? AND \`asset_id\` = ?
            `,
            [newQty, newAvg, portfolioId, assetId]
          );
        } else {
          await conn.execute(
            `
              INSERT INTO \`holding\` (\`portfolio_id\`, \`asset_id\`, \`quantity\`, \`avg_buy_price\`)
              VALUES (?, ?, ?, ?)
            `,
            [portfolioId, assetId, quantity, livePrice]
          );
        }

        const payload = await recalcAndPersistPortfolioValue(conn, portfolioId, userId);
        await conn.commit();
        res.json(payload);
      } catch (error) {
        await conn.rollback();
        throw error;
      }
    } catch (error: any) {
      console.error("[BUY OPERATION FAILED]:", error);
      res.status(500).json({ error: "BUY operation failed", details: error?.message || String(error) });
    } finally {
      conn.release();
    }
  });

  app.post("/api/v1/portfolio/:portfolioId/sell", authMiddleware, async (req, res) => {
    const { userId } = getAuth(req);
    const portfolioId = Number(req.params.portfolioId);
    const rawAssetId = Number(req.body?.asset_id);
    const requestTicker = typeof req.body?.ticker_symbol === "string" ? req.body.ticker_symbol : null;
    const requestAssetName = typeof req.body?.asset_name === "string" ? req.body.asset_name : null;
    const quantity = Number(req.body?.quantity);

    if (!portfolioId || !Number.isFinite(quantity) || quantity <= 0) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const conn = await getPool().getConnection();
    try {
      const [portfolioRows] = await conn.execute<mysql.RowDataPacket[]>(
        `SELECT \`portfolio_id\` FROM \`portfolio\` WHERE \`portfolio_id\` = ? AND \`user_id\` = ? LIMIT 1`,
        [portfolioId, userId]
      );
      if (!portfolioRows.length) {
        res.status(403).json({ error: "Unauthorized portfolio" });
        return;
      }

      const resolvedAsset = await ensureAssetForTrade(conn, {
        assetId: Number.isFinite(rawAssetId) && rawAssetId > 0 ? rawAssetId : null,
        tickerSymbol: requestTicker,
        assetName: requestAssetName,
      });
      const assetId = resolvedAsset.assetId;
      const tickerSymbol = resolvedAsset.tickerSymbol;
      const livePrice = await resolveTradePriceInInr(tickerSymbol);
      if (!livePrice || livePrice <= 0) {
        res.status(400).json({ error: "Unable to resolve tradable price" });
        return;
      }

      await conn.beginTransaction();
      try {
        const [holdingRows] = await conn.execute<mysql.RowDataPacket[]>(
          `SELECT \`quantity\` FROM \`holding\` WHERE \`portfolio_id\` = ? AND \`asset_id\` = ? LIMIT 1`,
          [portfolioId, assetId]
        );

        if (!holdingRows.length) {
          await conn.rollback();
          res.status(400).json({ error: "Insufficient quantity" });
          return;
        }

        const oldQty = Number(holdingRows[0].quantity);
        if (oldQty < quantity) {
          await conn.rollback();
          res.status(400).json({ error: "Insufficient quantity" });
          return;
        }

        await conn.execute(
          `
            INSERT INTO \`transaction\`
            (\`portfolio_id\`, \`asset_id\`, \`transaction_type\`, \`quantity\`, \`price\`, \`transaction_date\`)
            VALUES (?, ?, 'SELL', ?, ?, CURDATE())
          `,
          [portfolioId, assetId, quantity, livePrice]
        );

        const newQty = oldQty - quantity;
        if (newQty === 0) {
          await conn.execute(
            `DELETE FROM \`holding\` WHERE \`portfolio_id\` = ? AND \`asset_id\` = ?`,
            [portfolioId, assetId]
          );
        } else {
          await conn.execute(
            `UPDATE \`holding\` SET \`quantity\` = ? WHERE \`portfolio_id\` = ? AND \`asset_id\` = ?`,
            [newQty, portfolioId, assetId]
          );
        }

        const payload = await recalcAndPersistPortfolioValue(conn, portfolioId, userId);
        await conn.commit();
        res.json(payload);
      } catch (error) {
        await conn.rollback();
        throw error;
      }
    } catch (error: any) {
      console.error("[SELL OPERATION FAILED]:", error);
      res.status(500).json({ error: "SELL operation failed", details: error?.message || String(error) });
    } finally {
      conn.release();
    }
  });

  app.get("/api/v1/watchlist", authMiddleware, async (req, res) => {
    try {
      const { userId } = getAuth(req);
      const conn = await getPool().getConnection();
      try {
        const [rows] = await conn.execute<mysql.RowDataPacket[]>(
          `
            SELECT w.\`watchlist_id\`, a.\`asset_id\`, a.\`asset_name\`, a.\`ticker_symbol\`
            FROM \`watchlist\` w
            INNER JOIN \`asset\` a ON w.\`asset_id\` = a.\`asset_id\`
            WHERE w.\`user_id\` = ?
            ORDER BY w.\`watchlist_id\` DESC
          `,
          [userId]
        );
        res.json(
          rows.map(row => ({
            watchlist_id: Number(row.watchlist_id),
            asset_id: Number(row.asset_id),
            asset_name: String(row.asset_name),
            ticker_symbol: String(row.ticker_symbol),
          }))
        );
      } finally {
        conn.release();
      }
    } catch {
      res.status(500).json({ error: "Failed to fetch watchlist" });
    }
  });

  app.post("/api/v1/watchlist", authMiddleware, async (req, res) => {
    try {
      const { userId } = getAuth(req);
      const rawAssetId = Number(req.body?.asset_id);
      const tickerSymbol = typeof req.body?.ticker_symbol === "string" ? req.body.ticker_symbol : null;
      const assetName = typeof req.body?.asset_name === "string" ? req.body.asset_name : null;

      if (!rawAssetId && !tickerSymbol) {
        res.status(400).json({ error: "Invalid asset" });
        return;
      }

      const conn = await getPool().getConnection();
      try {
        const resolved = await ensureAssetForTrade(conn, {
          assetId: rawAssetId > 0 ? rawAssetId : null,
          tickerSymbol,
          assetName,
        });

        await conn.execute(
          `
            INSERT INTO \`watchlist\` (\`user_id\`, \`asset_id\`)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE \`asset_id\` = VALUES(\`asset_id\`)
          `,
          [userId, resolved.assetId]
        );
        res.json({ success: true });
      } finally {
        conn.release();
      }
    } catch (error: any) {
      console.error("[WATCHLIST ADD FAILED]:", error);
      res.status(500).json({ error: "Failed to add watchlist item", details: error?.message || String(error) });
    }
  });

  app.delete("/api/v1/watchlist/:assetId", authMiddleware, async (req, res) => {
    try {
      const { userId } = getAuth(req);
      const assetId = Number(req.params.assetId);
      if (!assetId) {
        res.status(400).json({ error: "Invalid asset" });
        return;
      }

      const conn = await getPool().getConnection();
      try {
        await conn.execute(
          `DELETE FROM \`watchlist\` WHERE \`user_id\` = ? AND \`asset_id\` = ?`,
          [userId, assetId]
        );
        res.json({ success: true });
      } finally {
        conn.release();
      }
    } catch {
      res.status(500).json({ error: "Failed to remove watchlist item" });
    }
  });

  app.get("/api/v1/transactions", authMiddleware, async (req, res) => {
    try {
      const { userId } = getAuth(req);
      const conn = await getPool().getConnection();
      try {
        const [rows] = await conn.execute<mysql.RowDataPacket[]>(
          `
            SELECT
              t.\`transaction_id\`,
              t.\`portfolio_id\`,
              t.\`asset_id\`,
              t.\`transaction_type\`,
              t.\`quantity\`,
              t.\`price\`,
              t.\`transaction_date\`,
              a.\`asset_name\`,
              a.\`ticker_symbol\`
            FROM \`transaction\` t
            INNER JOIN \`portfolio\` p ON p.\`portfolio_id\` = t.\`portfolio_id\`
            INNER JOIN \`asset\` a ON a.\`asset_id\` = t.\`asset_id\`
            WHERE p.\`user_id\` = ?
            ORDER BY t.\`transaction_date\` DESC, t.\`transaction_id\` DESC
          `,
          [userId]
        );

        res.json(
          rows.map(row => ({
            transaction_id: Number(row.transaction_id),
            portfolio_id: Number(row.portfolio_id),
            asset_id: Number(row.asset_id),
            transaction_type: String(row.transaction_type),
            quantity: Number(row.quantity),
            price: Number(row.price),
            total_value: Number(row.quantity) * Number(row.price),
            transaction_date: String(row.transaction_date),
            asset_name: String(row.asset_name),
            ticker_symbol: String(row.ticker_symbol),
          }))
        );
      } finally {
        conn.release();
      }
    } catch {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });
}
