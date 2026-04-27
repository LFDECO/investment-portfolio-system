CREATE TABLE `assetTypes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	CONSTRAINT `assetTypes_id` PRIMARY KEY(`id`),
	CONSTRAINT `assetTypes_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(20) NOT NULL,
	`name` varchar(255) NOT NULL,
	`assetTypeId` int NOT NULL,
	`exchangeId` int,
	`currency` varchar(10) DEFAULT 'USD',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `assets_ticker_unique` UNIQUE(`ticker`)
);
--> statement-breakpoint
CREATE TABLE `exchanges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`code` varchar(20) NOT NULL,
	`country` varchar(100),
	CONSTRAINT `exchanges_id` PRIMARY KEY(`id`),
	CONSTRAINT `exchanges_name_unique` UNIQUE(`name`),
	CONSTRAINT `exchanges_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `holdings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolioId` int NOT NULL,
	`assetId` int NOT NULL,
	`quantity` decimal(18,8) NOT NULL,
	`averagePurchasePrice` decimal(18,8) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `holdings_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_holdings_portfolio_asset` UNIQUE(`portfolioId`,`assetId`)
);
--> statement-breakpoint
CREATE TABLE `portfolios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `priceHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`price` decimal(18,8) NOT NULL,
	`priceDate` timestamp NOT NULL,
	`source` varchar(50) DEFAULT 'yahoo_finance',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `priceHistory_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_priceHistory_asset_date` UNIQUE(`assetId`,`priceDate`)
);
--> statement-breakpoint
CREATE TABLE `riskMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolioId` int NOT NULL,
	`volatility` decimal(10,6) DEFAULT '0',
	`riskScore` decimal(5,2) DEFAULT '0',
	`sharpeRatio` decimal(10,6),
	`beta` decimal(10,6),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `riskMetrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `riskMetrics_portfolioId_unique` UNIQUE(`portfolioId`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolioId` int NOT NULL,
	`assetId` int NOT NULL,
	`type` enum('BUY','SELL') NOT NULL,
	`quantity` decimal(18,8) NOT NULL,
	`price` decimal(18,8) NOT NULL,
	`totalValue` decimal(18,2) NOT NULL,
	`transactionDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `watchlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolioId` int NOT NULL,
	`assetId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `watchlist_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_watchlist_portfolio_asset` UNIQUE(`portfolioId`,`assetId`)
);
--> statement-breakpoint
ALTER TABLE `assets` ADD CONSTRAINT `assets_assetTypeId_assetTypes_id_fk` FOREIGN KEY (`assetTypeId`) REFERENCES `assetTypes`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assets` ADD CONSTRAINT `assets_exchangeId_exchanges_id_fk` FOREIGN KEY (`exchangeId`) REFERENCES `exchanges`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `holdings` ADD CONSTRAINT `holdings_portfolioId_portfolios_id_fk` FOREIGN KEY (`portfolioId`) REFERENCES `portfolios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `holdings` ADD CONSTRAINT `holdings_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolios` ADD CONSTRAINT `portfolios_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `priceHistory` ADD CONSTRAINT `priceHistory_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `riskMetrics` ADD CONSTRAINT `riskMetrics_portfolioId_portfolios_id_fk` FOREIGN KEY (`portfolioId`) REFERENCES `portfolios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_portfolioId_portfolios_id_fk` FOREIGN KEY (`portfolioId`) REFERENCES `portfolios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `watchlist` ADD CONSTRAINT `watchlist_portfolioId_portfolios_id_fk` FOREIGN KEY (`portfolioId`) REFERENCES `portfolios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `watchlist` ADD CONSTRAINT `watchlist_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_assets_ticker` ON `assets` (`ticker`);--> statement-breakpoint
CREATE INDEX `idx_assets_assetTypeId` ON `assets` (`assetTypeId`);--> statement-breakpoint
CREATE INDEX `idx_holdings_portfolioId` ON `holdings` (`portfolioId`);--> statement-breakpoint
CREATE INDEX `idx_holdings_assetId` ON `holdings` (`assetId`);--> statement-breakpoint
CREATE INDEX `idx_portfolios_userId` ON `portfolios` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_priceHistory_assetId` ON `priceHistory` (`assetId`);--> statement-breakpoint
CREATE INDEX `idx_priceHistory_date` ON `priceHistory` (`priceDate`);--> statement-breakpoint
CREATE INDEX `idx_transactions_portfolioId` ON `transactions` (`portfolioId`);--> statement-breakpoint
CREATE INDEX `idx_transactions_assetId` ON `transactions` (`assetId`);--> statement-breakpoint
CREATE INDEX `idx_transactions_date` ON `transactions` (`transactionDate`);--> statement-breakpoint
CREATE INDEX `idx_watchlist_portfolioId` ON `watchlist` (`portfolioId`);