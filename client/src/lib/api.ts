export const AUTH_TOKEN_STORAGE_KEY = "authToken";

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers ?? {});

  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...(init ?? {}),
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export type PortfolioHoldingDto = {
  asset_name: string;
  ticker_symbol: string;
  quantity: number;
  avg_buy_price: number;
  current_price: number;
  total_value: number;
};

export type PortfolioDto = {
  portfolio_id: number;
  total_value: number;
  holdings: PortfolioHoldingDto[];
};

export type AssetDto = {
  asset_id: number;
  asset_name: string;
  ticker_symbol: string;
  current_price: number | null;
  change?: number | null;
  change_percent?: number | null;
  volume?: number | null;
};

export type MarketStockDto = {
  asset_id: number;
  asset_name: string;
  ticker_symbol: string;
  current_price: number | null;
  change: number;
  change_percent: number;
  volume: number | null;
  market_state: string | null;
  market_time: number | null;
  currency?: string | null;
};

export type MarketHistoryPointDto = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export type MarketHistoryDto = {
  asset_id: number;
  asset_name: string;
  ticker_symbol: string;
  days: number;
  history: MarketHistoryPointDto[];
};

export type TransactionDto = {
  transaction_id: number;
  portfolio_id: number;
  asset_id: number;
  transaction_type: "BUY" | "SELL";
  quantity: number;
  price: number;
  total_value: number;
  transaction_date: string;
  asset_name: string;
  ticker_symbol: string;
};

export type WatchlistItemDto = {
  watchlist_id: number;
  asset_id: number;
  asset_name: string;
  ticker_symbol: string;
};

export function fetchDefaultPortfolio() {
  return apiRequest<PortfolioDto>("/api/v1/portfolio/default");
}

export function fetchPortfolio(portfolioId: number) {
  return apiRequest<PortfolioDto>(`/api/v1/portfolio/${portfolioId}`);
}

export function fetchAssets() {
  return apiRequest<AssetDto[]>("/api/v1/assets");
}

export function fetchMarketDaily(query?: { q?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (query?.q) params.set("q", query.q);
  if (query?.limit) params.set("limit", String(query.limit));
  const path = `/api/v1/market/daily${params.toString() ? `?${params.toString()}` : ""}`;
  return apiRequest<MarketStockDto[]>(path);
}

export function fetchTrendingStocks(query?: {
  type?: "gainers" | "losers" | "active";
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (query?.type) params.set("type", query.type);
  if (query?.limit) params.set("limit", String(query.limit));
  const path = `/api/v1/market/trending${params.toString() ? `?${params.toString()}` : ""}`;
  return apiRequest<MarketStockDto[]>(path);
}

export function fetchMarketHistory(assetId: number, days: number = 30, tickerSymbol?: string) {
  const params = new URLSearchParams();
  params.set("days", String(days));
  if (assetId > 0) params.set("asset_id", String(assetId));
  if (tickerSymbol) params.set("ticker_symbol", tickerSymbol);
  return apiRequest<MarketHistoryDto>(
    `/api/v1/market/history/${assetId}?${params.toString()}`
  );
}

export function fetchMarketAsset(assetId: number, tickerSymbol?: string) {
  const params = new URLSearchParams();
  if (tickerSymbol) params.set("ticker_symbol", tickerSymbol);
  const path = `/api/v1/market/asset/${assetId}${params.toString() ? `?${params.toString()}` : ""}`;
  return apiRequest<MarketStockDto>(path);
}

export function buyAsset(
  portfolioId: number,
  assetId: number,
  quantity: number,
  tickerSymbol?: string,
  assetName?: string
) {
  return apiRequest<PortfolioDto>(`/api/v1/portfolio/${portfolioId}/buy`, {
    method: "POST",
    body: JSON.stringify({ asset_id: assetId, quantity, ticker_symbol: tickerSymbol, asset_name: assetName }),
  });
}

export function sellAsset(
  portfolioId: number,
  assetId: number,
  quantity: number,
  tickerSymbol?: string,
  assetName?: string
) {
  return apiRequest<PortfolioDto>(`/api/v1/portfolio/${portfolioId}/sell`, {
    method: "POST",
    body: JSON.stringify({ asset_id: assetId, quantity, ticker_symbol: tickerSymbol, asset_name: assetName }),
  });
}

export function fetchTransactions() {
  return apiRequest<TransactionDto[]>("/api/v1/transactions");
}

export function fetchWatchlist() {
  return apiRequest<WatchlistItemDto[]>("/api/v1/watchlist");
}

export function addWatchlistItem(assetId: number, tickerSymbol?: string, assetName?: string) {
  return apiRequest<{ success: boolean }>("/api/v1/watchlist", {
    method: "POST",
    body: JSON.stringify({ asset_id: assetId, ticker_symbol: tickerSymbol, asset_name: assetName }),
  });
}

export function removeWatchlistItem(assetId: number) {
  return apiRequest<{ success: boolean }>(`/api/v1/watchlist/${assetId}`, {
    method: "DELETE",
  });
}
