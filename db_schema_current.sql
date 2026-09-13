-- Portfolio.Ai Current MySQL Schema Dump

DROP TABLE IF EXISTS `asset`;
CREATE TABLE `asset` (
  `asset_id` int NOT NULL AUTO_INCREMENT,
  `asset_name` varchar(80) NOT NULL,
  `ticker_symbol` varchar(20) NOT NULL,
  `asset_type_id` int DEFAULT '1',
  `exchange_id` int DEFAULT '1',
  PRIMARY KEY (`asset_id`),
  UNIQUE KEY `ticker_symbol` (`ticker_symbol`),
  KEY `asset_type_id` (`asset_type_id`),
  KEY `exchange_id` (`exchange_id`),
  CONSTRAINT `asset_ibfk_1` FOREIGN KEY (`asset_type_id`) REFERENCES `asset_type` (`asset_type_id`),
  CONSTRAINT `asset_ibfk_2` FOREIGN KEY (`exchange_id`) REFERENCES `exchange` (`exchange_id`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `asset_type`;
CREATE TABLE `asset_type` (
  `asset_type_id` int NOT NULL AUTO_INCREMENT,
  `type_name` varchar(30) NOT NULL,
  PRIMARY KEY (`asset_type_id`),
  UNIQUE KEY `type_name` (`type_name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `exchange`;
CREATE TABLE `exchange` (
  `exchange_id` int NOT NULL AUTO_INCREMENT,
  `exchange_name` varchar(50) NOT NULL,
  `country` varchar(50) NOT NULL,
  PRIMARY KEY (`exchange_id`),
  UNIQUE KEY `exchange_name` (`exchange_name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `holding`;
CREATE TABLE `holding` (
  `holding_id` int NOT NULL AUTO_INCREMENT,
  `portfolio_id` int NOT NULL,
  `asset_id` int NOT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `avg_buy_price` decimal(15,2) NOT NULL,
  PRIMARY KEY (`holding_id`),
  UNIQUE KEY `portfolio_id` (`portfolio_id`,`asset_id`),
  KEY `asset_id` (`asset_id`),
  CONSTRAINT `holding_ibfk_1` FOREIGN KEY (`portfolio_id`) REFERENCES `portfolio` (`portfolio_id`) ON DELETE CASCADE,
  CONSTRAINT `holding_ibfk_2` FOREIGN KEY (`asset_id`) REFERENCES `asset` (`asset_id`) ON DELETE CASCADE,
  CONSTRAINT `holding_chk_1` CHECK ((`quantity` >= 0)),
  CONSTRAINT `holding_chk_2` CHECK ((`avg_buy_price` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `performance`;
CREATE TABLE `performance` (
  `performance_id` int NOT NULL AUTO_INCREMENT,
  `portfolio_id` int NOT NULL,
  `return_percentage` decimal(6,2) DEFAULT '0.00',
  `calculated_on` date NOT NULL,
  PRIMARY KEY (`performance_id`),
  KEY `portfolio_id` (`portfolio_id`),
  CONSTRAINT `performance_ibfk_1` FOREIGN KEY (`portfolio_id`) REFERENCES `portfolio` (`portfolio_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `portfolio`;
CREATE TABLE `portfolio` (
  `portfolio_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `portfolio_name` varchar(50) NOT NULL,
  `created_at` date NOT NULL,
  `total_value` decimal(15,2) DEFAULT '0.00',
  PRIMARY KEY (`portfolio_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `portfolio_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `price_history`;
CREATE TABLE `price_history` (
  `price_id` int NOT NULL AUTO_INCREMENT,
  `asset_id` int NOT NULL,
  `price_date` date NOT NULL,
  `closing_price` decimal(15,2) NOT NULL,
  PRIMARY KEY (`price_id`),
  UNIQUE KEY `asset_id` (`asset_id`,`price_date`),
  CONSTRAINT `price_history_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `asset` (`asset_id`) ON DELETE CASCADE,
  CONSTRAINT `price_history_chk_1` CHECK ((`closing_price` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `risk_metric`;
CREATE TABLE `risk_metric` (
  `risk_id` int NOT NULL AUTO_INCREMENT,
  `portfolio_id` int NOT NULL,
  `volatility` decimal(10,4) DEFAULT '0.0000',
  `risk_score` int DEFAULT '0',
  PRIMARY KEY (`risk_id`),
  KEY `portfolio_id` (`portfolio_id`),
  CONSTRAINT `risk_metric_ibfk_1` FOREIGN KEY (`portfolio_id`) REFERENCES `portfolio` (`portfolio_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `transaction`;
CREATE TABLE `transaction` (
  `transaction_id` int NOT NULL AUTO_INCREMENT,
  `portfolio_id` int NOT NULL,
  `asset_id` int NOT NULL,
  `transaction_type` enum('BUY','SELL') NOT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `price` decimal(15,2) NOT NULL,
  `transaction_date` date NOT NULL,
  PRIMARY KEY (`transaction_id`),
  KEY `portfolio_id` (`portfolio_id`),
  KEY `asset_id` (`asset_id`),
  CONSTRAINT `transaction_ibfk_1` FOREIGN KEY (`portfolio_id`) REFERENCES `portfolio` (`portfolio_id`) ON DELETE CASCADE,
  CONSTRAINT `transaction_ibfk_2` FOREIGN KEY (`asset_id`) REFERENCES `asset` (`asset_id`) ON DELETE CASCADE,
  CONSTRAINT `transaction_chk_1` CHECK ((`quantity` > 0)),
  CONSTRAINT `transaction_chk_2` CHECK ((`price` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `email` varchar(60) NOT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `created_at` date NOT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=758 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `watchlist`;
CREATE TABLE `watchlist` (
  `watchlist_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `asset_id` int NOT NULL,
  PRIMARY KEY (`watchlist_id`),
  UNIQUE KEY `user_id` (`user_id`,`asset_id`),
  KEY `asset_id` (`asset_id`),
  CONSTRAINT `watchlist_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `watchlist_ibfk_2` FOREIGN KEY (`asset_id`) REFERENCES `asset` (`asset_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

