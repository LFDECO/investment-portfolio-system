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
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

const DEFAULT_MARKET_SYMBOLS = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "NVDA",
  "TSLA",
  "META",
  "NFLX",
  "JPM",
  "BAC",
  "RELIANCE.NS",
  "TCS.NS",
  "INFY.NS",
  "HDFCBANK.NS",
  "ICICIBANK.NS",
];
const NSE_CORE_SYMBOLS = [
  "ITC.NS",
  "SBIN.NS",
  "HINDUNILVR.NS",
  "LT.NS",
  "AXISBANK.NS",
  "BAJFINANCE.NS",
  "BHARTIARTL.NS",
  "KOTAKBANK.NS",
  "MARUTI.NS",
  "SUNPHARMA.NS",
  "TITAN.NS",
  "ULTRACEMCO.NS",
  "WIPRO.NS",
  "ASIANPAINT.NS",
  "ADANIENT.NS",
  "NTPC.NS",
  "POWERGRID.NS",
  "ONGC.NS",
  "TATAMOTORS.NS",
  "HCLTECH.NS",
];
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

async function fetchUsdInrRate(): Promise<number> {
  try {
    const { data } = await axios.get(
      "https://query1.finance.yahoo.com/v7/finance/quote?symbols=USDINR=X",
      { timeout: 8000 }
    );
    const row = data?.quoteResponse?.result?.[0];
    const price = row?.regularMarketPrice;
    if (typeof price === "number" && Number.isFinite(price) && price > 0) {
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
  const usdInrRate = await fetchUsdInrRate();
  for (let i = 0; i < uniqueSymbols.length; i += YAHOO_QUOTE_BATCH_SIZE) {
    const chunk = uniqueSymbols.slice(i, i + YAHOO_QUOTE_BATCH_SIZE);
    if (chunk.length === 0) continue;

    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
        chunk.join(",")
      )}`;
      const { data } = await axios.get(url, { timeout: 8000 });
      const rows = data?.quoteResponse?.result;
      if (!Array.isArray(rows)) continue;

      for (const row of rows) {
        const symbol = row?.symbol;
        const currencyRaw =
          typeof row?.currency === "string" && row.currency
            ? row.currency
            : typeof symbol === "string"
              ? inferCurrencyFromSymbol(symbol)
              : null;
        const price = row?.regularMarketPrice;
        const previousClose = row?.regularMarketPreviousClose;
        const normalizedPreviousClose =
          typeof previousClose === "number" && Number.isFinite(previousClose)
            ? convertPriceToInr(previousClose, currencyRaw, usdInrRate)
            : null;
        const effectivePrice =
          typeof price === "number" && Number.isFinite(price)
            ? convertPriceToInr(price, currencyRaw, usdInrRate)
            : normalizedPreviousClose;
        if (
          typeof symbol === "string" &&
          typeof effectivePrice === "number" &&
          Number.isFinite(effectivePrice)
        ) {
          const inferredChange =
            normalizedPreviousClose !== null
              ? effectivePrice - normalizedPreviousClose
              : 0;
          const inferredChangePercent =
            normalizedPreviousClose && normalizedPreviousClose > 0
              ? (inferredChange / normalizedPreviousClose) * 100
              : 0;

          map.set(symbol, {
            price: effectivePrice,
            previousClose: normalizedPreviousClose,
            change:
              typeof row?.regularMarketChange === "number" &&
                Number.isFinite(row.regularMarketChange)
                ? convertPriceToInr(row.regularMarketChange, currencyRaw, usdInrRate)
                : inferredChange,
            changePercent:
              typeof row?.regularMarketChangePercent === "number" &&
                Number.isFinite(row.regularMarketChangePercent)
                ? row.regularMarketChangePercent
                : inferredChangePercent,
            volume:
              typeof row?.regularMarketVolume === "number"
                ? row.regularMarketVolume
                : null,
            marketState:
              typeof row?.marketState === "string" ? row.marketState : null,
            marketTime:
              typeof row?.regularMarketTime === "number"
                ? row.regularMarketTime
                : null,
            currency: currencyRaw ?? null,
          });
        }
      }
    } catch {
      // Continue with other chunks so one failed request does not blank the whole page.
    }
  }

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

async function fetchYahooQuoteRows(symbols: string[]) {
  const uniqueSymbols = Array.from(new Set(symbols.filter(Boolean)));
  if (uniqueSymbols.length === 0) return [] as Array<{
    symbol: string;
    name: string;
    snapshot: QuoteSnapshot;
  }>;

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    uniqueSymbols.join(",")
  )}`;
  const { data } = await axios.get(url, { timeout: 8000 });
  const rows = data?.quoteResponse?.result;
  if (!Array.isArray(rows)) return [];

  const payload: Array<{
    symbol: string;
    name: string;
    snapshot: QuoteSnapshot;
  }> = [];

  for (const row of rows) {
    const symbol = typeof row?.symbol === "string" ? row.symbol : null;
    const rawName =
      (typeof row?.longName === "string" && row.longName) ||
      (typeof row?.shortName === "string" && row.shortName) ||
      symbol ||
      "Unknown Asset";

    const price = row?.regularMarketPrice;
    const previousClose = row?.regularMarketPreviousClose;
    const normalizedPreviousClose =
      typeof previousClose === "number" && Number.isFinite(previousClose)
        ? previousClose
        : null;
    const effectivePrice =
      typeof price === "number" && Number.isFinite(price)
        ? price
        : normalizedPreviousClose;

    if (!symbol || typeof effectivePrice !== "number" || !Number.isFinite(effectivePrice)) {
      continue;
    }

    const inferredChange =
      normalizedPreviousClose !== null
        ? effectivePrice - normalizedPreviousClose
        : 0;
    const inferredChangePercent =
      normalizedPreviousClose && normalizedPreviousClose > 0
        ? (inferredChange / normalizedPreviousClose) * 100
        : 0;

    payload.push({
      symbol,
      name: rawName,
      snapshot: {
        price: effectivePrice,
        previousClose: normalizedPreviousClose,
        change:
          typeof row?.regularMarketChange === "number" &&
            Number.isFinite(row.regularMarketChange)
            ? row.regularMarketChange
            : inferredChange,
        changePercent:
          typeof row?.regularMarketChangePercent === "number" &&
            Number.isFinite(row.regularMarketChangePercent)
            ? row.regularMarketChangePercent
            : inferredChangePercent,
        volume:
          typeof row?.regularMarketVolume === "number"
            ? row.regularMarketVolume
            : null,
        marketState:
          typeof row?.marketState === "string" ? row.marketState : null,
        marketTime:
          typeof row?.regularMarketTime === "number"
            ? row.regularMarketTime
            : null,
        currency:
          typeof row?.currency === "string" && row.currency
            ? row.currency
            : inferCurrencyFromSymbol(symbol),
      },
    });
  }

  return payload;
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

function getYahooRangeForDays(days: number): string {
  if (days <= 30) return "1mo";
  if (days <= 90) return "3mo";
  if (days <= 180) return "6mo";
  if (days <= 365) return "1y";
  return "2y";
}

async function fetchHistoricalPrices(
  symbol: string,
  days: number
): Promise<HistoricalPoint[]> {
  const range = getYahooRangeForDays(days);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=1d`;

  const { data } = await axios.get(url, { timeout: 8000 });
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  if (!Array.isArray(timestamps) || !quote) return [];

  const rows: HistoricalPoint[] = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const ts = timestamps[i];
    const open = quote?.open?.[i];
    const high = quote?.high?.[i];
    const low = quote?.low?.[i];
    const close = quote?.close?.[i];
    const volume = quote?.volume?.[i];

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
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open,
      high,
      low,
      close,
      volume: typeof volume === "number" ? volume : null,
    });
  }

  return rows.slice(-Math.max(1, days));
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
      const assetId = Number(req.params.assetId);
      const tickerSymbol = String(req.query.ticker_symbol ?? "").trim().toUpperCase();

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
      const byId = !byTicker && assetId
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

  app.get("/api/v1/market/trending", authMiddleware, async (req, res) => {
    try {
      const type = String(req.query.type ?? "gainers").toLowerCase();
      const limitRaw = Number(req.query.limit ?? 10);
      const limit = Number.isFinite(limitRaw)
        ? Math.max(1, Math.min(10, Math.floor(limitRaw)))
        : 10;
      const universe = await getNseUniverseRows();
      const candidateUniverse = universe.slice(0, 600);
      const symbols = candidateUniverse.map(row => row.symbol);
      let quotes = await fetchLiveQuoteSnapshots(symbols);
      quotes = await enrichMissingQuotesWithHistory(symbols, quotes);

      const payload = candidateUniverse.map(row => {
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
      });

      const sorted = [...payload].sort((a, b) => {
        if (type === "losers") return a.change_percent - b.change_percent;
        if (type === "active") return (b.volume ?? 0) - (a.volume ?? 0);
        return b.change_percent - a.change_percent;
      });

      res.json(sorted.slice(0, limit));
    } catch {
      res.status(500).json({ error: "Failed to fetch trending stocks" });
    }
  });

  app.get("/api/v1/market/history/:assetId", authMiddleware, async (req, res) => {
    try {
      const assetId = Number(req.params.assetId);
      const tickerFromQuery = String(req.query.ticker_symbol ?? "").trim().toUpperCase();
      const daysRaw = Number(req.query.days ?? 30);
      const days = Number.isFinite(daysRaw)
        ? Math.max(5, Math.min(365, Math.floor(daysRaw)))
        : 30;
      const universe = await getNseUniverseRows();
      const byTicker = tickerFromQuery
        ? universe.find(row => row.symbol.toUpperCase() === tickerFromQuery)
        : null;
      const byId = !byTicker && assetId
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
