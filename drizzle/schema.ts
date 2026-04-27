import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar, foreignKey, index, unique } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Portfolio table - stores portfolio accounts created by users
export const portfolios = mysqlTable(
  "portfolios",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    foreignKey({ columns: [table.userId], foreignColumns: [users.id] }).onDelete("cascade"),
    index("idx_portfolios_userId").on(table.userId),
  ]
);

export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = typeof portfolios.$inferInsert;

// Asset Type table - stores categories of assets
export const assetTypes = mysqlTable("assetTypes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
});

export type AssetType = typeof assetTypes.$inferSelect;
export type InsertAssetType = typeof assetTypes.$inferInsert;

// Exchange table - stores stock exchange or trading platform information
export const exchanges = mysqlTable("exchanges", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  country: varchar("country", { length: 100 }),
});

export type Exchange = typeof exchanges.$inferSelect;
export type InsertExchange = typeof exchanges.$inferInsert;

// Asset table - stores investment instruments
export const assets = mysqlTable(
  "assets",
  {
    id: int("id").autoincrement().primaryKey(),
    ticker: varchar("ticker", { length: 20 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    assetTypeId: int("assetTypeId").notNull(),
    exchangeId: int("exchangeId"),
    currency: varchar("currency", { length: 10 }).default("USD"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({ columns: [table.assetTypeId], foreignColumns: [assetTypes.id] }).onDelete("restrict"),
    foreignKey({ columns: [table.exchangeId], foreignColumns: [exchanges.id] }).onDelete("set null"),
    index("idx_assets_ticker").on(table.ticker),
    index("idx_assets_assetTypeId").on(table.assetTypeId),
  ]
);

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;

// Holding table - stores assets currently held in a portfolio
export const holdings = mysqlTable(
  "holdings",
  {
    id: int("id").autoincrement().primaryKey(),
    portfolioId: int("portfolioId").notNull(),
    assetId: int("assetId").notNull(),
    quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
    averagePurchasePrice: decimal("averagePurchasePrice", { precision: 18, scale: 8 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    foreignKey({ columns: [table.portfolioId], foreignColumns: [portfolios.id] }).onDelete("cascade"),
    foreignKey({ columns: [table.assetId], foreignColumns: [assets.id] }).onDelete("restrict"),
    unique("uq_holdings_portfolio_asset").on(table.portfolioId, table.assetId),
    index("idx_holdings_portfolioId").on(table.portfolioId),
    index("idx_holdings_assetId").on(table.assetId),
  ]
);

export type Holding = typeof holdings.$inferSelect;
export type InsertHolding = typeof holdings.$inferInsert;

// Transaction table - stores buy and sell transaction history
export const transactions = mysqlTable(
  "transactions",
  {
    id: int("id").autoincrement().primaryKey(),
    portfolioId: int("portfolioId").notNull(),
    assetId: int("assetId").notNull(),
    type: mysqlEnum("type", ["BUY", "SELL"]).notNull(),
    quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
    price: decimal("price", { precision: 18, scale: 8 }).notNull(),
    totalValue: decimal("totalValue", { precision: 18, scale: 2 }).notNull(),
    transactionDate: timestamp("transactionDate").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({ columns: [table.portfolioId], foreignColumns: [portfolios.id] }).onDelete("cascade"),
    foreignKey({ columns: [table.assetId], foreignColumns: [assets.id] }).onDelete("restrict"),
    index("idx_transactions_portfolioId").on(table.portfolioId),
    index("idx_transactions_assetId").on(table.assetId),
    index("idx_transactions_date").on(table.transactionDate),
  ]
);

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// Price History table - stores historical market prices
export const priceHistory = mysqlTable(
  "priceHistory",
  {
    id: int("id").autoincrement().primaryKey(),
    assetId: int("assetId").notNull(),
    price: decimal("price", { precision: 18, scale: 8 }).notNull(),
    priceDate: timestamp("priceDate").notNull(),
    source: varchar("source", { length: 50 }).default("yahoo_finance"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({ columns: [table.assetId], foreignColumns: [assets.id] }).onDelete("cascade"),
    unique("uq_priceHistory_asset_date").on(table.assetId, table.priceDate),
    index("idx_priceHistory_assetId").on(table.assetId),
    index("idx_priceHistory_date").on(table.priceDate),
  ]
);

export type PriceHistory = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = typeof priceHistory.$inferInsert;

// Watchlist table - stores assets users wish to track without purchasing
export const watchlist = mysqlTable(
  "watchlist",
  {
    id: int("id").autoincrement().primaryKey(),
    portfolioId: int("portfolioId").notNull(),
    assetId: int("assetId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({ columns: [table.portfolioId], foreignColumns: [portfolios.id] }).onDelete("cascade"),
    foreignKey({ columns: [table.assetId], foreignColumns: [assets.id] }).onDelete("cascade"),
    unique("uq_watchlist_portfolio_asset").on(table.portfolioId, table.assetId),
    index("idx_watchlist_portfolioId").on(table.portfolioId),
  ]
);

export type Watchlist = typeof watchlist.$inferSelect;
export type InsertWatchlist = typeof watchlist.$inferInsert;

// Risk Metric table - stores risk-related metrics
export const riskMetrics = mysqlTable(
  "riskMetrics",
  {
    id: int("id").autoincrement().primaryKey(),
    portfolioId: int("portfolioId").notNull().unique(),
    volatility: decimal("volatility", { precision: 10, scale: 6 }).default("0"),
    riskScore: decimal("riskScore", { precision: 5, scale: 2 }).default("0"),
    sharpeRatio: decimal("sharpeRatio", { precision: 10, scale: 6 }),
    beta: decimal("beta", { precision: 10, scale: 6 }),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    foreignKey({ columns: [table.portfolioId], foreignColumns: [portfolios.id] }).onDelete("cascade"),
  ]
);

export type RiskMetric = typeof riskMetrics.$inferSelect;
export type InsertRiskMetric = typeof riskMetrics.$inferInsert;