-- Portfolio.Ai Current MySQL Data Dump

INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (1, 'Reliance Industries', 'RELIANCE.NS', 1, 1);
INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (2, 'Tata Consultancy Services', 'TCS.NS', 1, 1);
INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (3, 'Infosys Limited', 'INFY.NS', 1, 1);
INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (4, 'Apple Inc.', 'AAPL', 1, 3);
INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (5, 'Microsoft Corp.', 'MSFT', 1, 3);
INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (6, 'Nifty 50 ETF', 'NIFTYBEES.NS', 2, 1);
INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (7, 'Airo Lam limited', 'AIROLAM.NS', 1, 1);
INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (9, 'Adani Green Energy Limited', 'ADANIGREEN.NS', 1, 1);
INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (10, 'Akg Exim Limited', 'AKG.NS', 1, 1);
INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (11, 'Reliable Data Services Limited', 'RELIABLE.NS', 1, 1);
INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (12, 'Adani Enterprises Limited', 'ADANIENT.NS', 1, 1);
INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (14, 'Anlon Healthcare Limited', 'AHCL.NS', 1, 1);
INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (16, 'ITC Limited', 'ITC.NS', 1, 1);
INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (17, 'HCL Technologies Limited', 'HCLTECH.NS', 1, 1);
INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (20, 'Hindustan Aeronautics Limited', 'HAL.NS', 1, 1);
INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (22, 'Hindustan Unilever Limited', 'HINDUNILVR.NS', 1, 1);
INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (23, 'Adani Total Gas Limited', 'ATGL.NS', 1, 1);
INSERT INTO `asset` (`asset_id`, `asset_name`, `ticker_symbol`, `asset_type_id`, `exchange_id`) VALUES (26, 'Adani Ports and Special Economic Zone Limited', 'ADANIPORTS.NS', 1, 1);

INSERT INTO `asset_type` (`asset_type_id`, `type_name`) VALUES (5, 'Bond');
INSERT INTO `asset_type` (`asset_type_id`, `type_name`) VALUES (4, 'Crypto');
INSERT INTO `asset_type` (`asset_type_id`, `type_name`) VALUES (1, 'Equity');
INSERT INTO `asset_type` (`asset_type_id`, `type_name`) VALUES (2, 'ETF');
INSERT INTO `asset_type` (`asset_type_id`, `type_name`) VALUES (3, 'Mutual Fund');

INSERT INTO `exchange` (`exchange_id`, `exchange_name`, `country`) VALUES (1, 'NSE', 'India');
INSERT INTO `exchange` (`exchange_id`, `exchange_name`, `country`) VALUES (2, 'BSE', 'India');
INSERT INTO `exchange` (`exchange_id`, `exchange_name`, `country`) VALUES (3, 'NASDAQ', 'USA');
INSERT INTO `exchange` (`exchange_id`, `exchange_name`, `country`) VALUES (4, 'NYSE', 'USA');
INSERT INTO `exchange` (`exchange_id`, `exchange_name`, `country`) VALUES (5, 'Binance', 'Global');

INSERT INTO `holding` (`holding_id`, `portfolio_id`, `asset_id`, `quantity`, `avg_buy_price`) VALUES (1, 1, 1, '10.0000', '2500.00');
INSERT INTO `holding` (`holding_id`, `portfolio_id`, `asset_id`, `quantity`, `avg_buy_price`) VALUES (2, 1, 2, '5.0000', '3600.00');
INSERT INTO `holding` (`holding_id`, `portfolio_id`, `asset_id`, `quantity`, `avg_buy_price`) VALUES (3, 2, 3, '20.0000', '1450.00');
INSERT INTO `holding` (`holding_id`, `portfolio_id`, `asset_id`, `quantity`, `avg_buy_price`) VALUES (4, 2, 6, '50.0000', '210.00');
INSERT INTO `holding` (`holding_id`, `portfolio_id`, `asset_id`, `quantity`, `avg_buy_price`) VALUES (5, 3, 4, '2.0000', '175.50');
INSERT INTO `holding` (`holding_id`, `portfolio_id`, `asset_id`, `quantity`, `avg_buy_price`) VALUES (8, 4, 9, '1.0000', '1235.80');
INSERT INTO `holding` (`holding_id`, `portfolio_id`, `asset_id`, `quantity`, `avg_buy_price`) VALUES (9, 4, 10, '10.0000', '11.83');
INSERT INTO `holding` (`holding_id`, `portfolio_id`, `asset_id`, `quantity`, `avg_buy_price`) VALUES (10, 4, 14, '2.0000', '15.87');
INSERT INTO `holding` (`holding_id`, `portfolio_id`, `asset_id`, `quantity`, `avg_buy_price`) VALUES (11, 4, 17, '0.0200', '1228.20');
INSERT INTO `holding` (`holding_id`, `portfolio_id`, `asset_id`, `quantity`, `avg_buy_price`) VALUES (12, 4, 3, '4.0000', '1170.30');
INSERT INTO `holding` (`holding_id`, `portfolio_id`, `asset_id`, `quantity`, `avg_buy_price`) VALUES (13, 4, 20, '5.0000', '4340.36');
INSERT INTO `holding` (`holding_id`, `portfolio_id`, `asset_id`, `quantity`, `avg_buy_price`) VALUES (14, 4, 22, '7.0000', '2327.40');
INSERT INTO `holding` (`holding_id`, `portfolio_id`, `asset_id`, `quantity`, `avg_buy_price`) VALUES (15, 4, 23, '19.0000', '647.20');
INSERT INTO `holding` (`holding_id`, `portfolio_id`, `asset_id`, `quantity`, `avg_buy_price`) VALUES (16, 4, 26, '6.0000', '1725.00');

INSERT INTO `performance` (`performance_id`, `portfolio_id`, `return_percentage`, `calculated_on`) VALUES (1, 1, '5.20', '2026-01-31 18:30:00');
INSERT INTO `performance` (`performance_id`, `portfolio_id`, `return_percentage`, `calculated_on`) VALUES (2, 2, '3.80', '2026-01-31 18:30:00');
INSERT INTO `performance` (`performance_id`, `portfolio_id`, `return_percentage`, `calculated_on`) VALUES (3, 3, '2.10', '2026-01-31 18:30:00');

INSERT INTO `portfolio` (`portfolio_id`, `user_id`, `portfolio_name`, `created_at`, `total_value`) VALUES (1, 1, 'Long Term Portfolio', '2026-01-14 18:30:00', '0.00');
INSERT INTO `portfolio` (`portfolio_id`, `user_id`, `portfolio_name`, `created_at`, `total_value`) VALUES (2, 1, 'Trading Portfolio', '2026-01-19 18:30:00', '0.00');
INSERT INTO `portfolio` (`portfolio_id`, `user_id`, `portfolio_name`, `created_at`, `total_value`) VALUES (3, 2, 'Growth Portfolio', '2026-01-17 18:30:00', '0.00');
INSERT INTO `portfolio` (`portfolio_id`, `user_id`, `portfolio_name`, `created_at`, `total_value`) VALUES (4, 3, 'Default Portfolio', '2026-04-24 18:30:00', '66732.00');
INSERT INTO `portfolio` (`portfolio_id`, `user_id`, `portfolio_name`, `created_at`, `total_value`) VALUES (5, 512, 'Default Portfolio', '2026-04-26 18:30:00', '0.00');
INSERT INTO `portfolio` (`portfolio_id`, `user_id`, `portfolio_name`, `created_at`, `total_value`) VALUES (6, 584, 'Default Portfolio', '2026-04-29 18:30:00', '0.00');

INSERT INTO `price_history` (`price_id`, `asset_id`, `price_date`, `closing_price`) VALUES (1, 1, '2026-01-31 18:30:00', '2600.00');
INSERT INTO `price_history` (`price_id`, `asset_id`, `price_date`, `closing_price`) VALUES (2, 2, '2026-01-31 18:30:00', '3700.00');
INSERT INTO `price_history` (`price_id`, `asset_id`, `price_date`, `closing_price`) VALUES (3, 3, '2026-01-31 18:30:00', '1500.00');
INSERT INTO `price_history` (`price_id`, `asset_id`, `price_date`, `closing_price`) VALUES (4, 4, '2026-01-31 18:30:00', '182.25');
INSERT INTO `price_history` (`price_id`, `asset_id`, `price_date`, `closing_price`) VALUES (5, 5, '2026-01-31 18:30:00', '410.10');
INSERT INTO `price_history` (`price_id`, `asset_id`, `price_date`, `closing_price`) VALUES (6, 6, '2026-01-31 18:30:00', '220.00');

INSERT INTO `risk_metric` (`risk_id`, `portfolio_id`, `volatility`, `risk_score`) VALUES (1, 1, '0.8500', 6);
INSERT INTO `risk_metric` (`risk_id`, `portfolio_id`, `volatility`, `risk_score`) VALUES (2, 2, '1.2000', 8);
INSERT INTO `risk_metric` (`risk_id`, `portfolio_id`, `volatility`, `risk_score`) VALUES (3, 3, '0.7000', 5);

INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (1, 1, 1, 'BUY', '10.0000', '2500.00', '2026-01-15 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (2, 1, 2, 'BUY', '5.0000', '3600.00', '2026-01-16 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (3, 2, 3, 'BUY', '20.0000', '1450.00', '2026-01-21 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (4, 2, 6, 'BUY', '50.0000', '210.00', '2026-01-22 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (5, 3, 4, 'BUY', '2.0000', '175.50', '2026-01-24 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (6, 4, 3, 'BUY', '31.0000', '1154.60', '2026-04-26 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (7, 4, 3, 'SELL', '31.0000', '1154.60', '2026-04-26 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (8, 4, 7, 'BUY', '2.0000', '85.72', '2026-04-26 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (9, 4, 7, 'SELL', '2.0000', '85.72', '2026-04-26 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (10, 4, 9, 'BUY', '3.0000', '1235.80', '2026-04-26 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (11, 4, 10, 'BUY', '10.0000', '11.83', '2026-04-26 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (12, 4, 14, 'BUY', '2.0000', '15.87', '2026-04-26 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (13, 4, 9, 'SELL', '2.0000', '1229.70', '2026-04-26 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (14, 4, 17, 'BUY', '5.0000', '1228.20', '2026-04-26 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (15, 4, 3, 'BUY', '4.0000', '1170.30', '2026-04-26 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (16, 4, 17, 'SELL', '2.0000', '1228.20', '2026-04-26 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (17, 4, 20, 'BUY', '3.0000', '4348.00', '2026-04-29 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (18, 4, 20, 'BUY', '2.0000', '4328.90', '2026-04-29 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (19, 4, 22, 'BUY', '7.0000', '2327.40', '2026-05-04 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (20, 4, 23, 'BUY', '19.0000', '647.20', '2026-05-04 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (21, 4, 17, 'SELL', '2.9700', '1200.20', '2026-05-04 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (22, 4, 17, 'SELL', '0.0100', '1200.20', '2026-05-04 18:30:00');
INSERT INTO `transaction` (`transaction_id`, `portfolio_id`, `asset_id`, `transaction_type`, `quantity`, `price`, `transaction_date`) VALUES (23, 4, 26, 'BUY', '6.0000', '1725.00', '2026-05-04 18:30:00');

INSERT INTO `user` (`user_id`, `name`, `email`, `phone`, `created_at`) VALUES (1, 'Siddhartha Bhaduri', 'sid@gmail.com', '9876543210', '2026-01-09 18:30:00');
INSERT INTO `user` (`user_id`, `name`, `email`, `phone`, `created_at`) VALUES (2, 'Priyanshu Singh', 'priyanshu@gmail.com', '9123456780', '2026-01-11 18:30:00');
INSERT INTO `user` (`user_id`, `name`, `email`, `phone`, `created_at`) VALUES (3, 'Siddhartha Bhaduri', 'sbhaduri2910@gmail.com', NULL, '2026-04-24 18:30:00');
INSERT INTO `user` (`user_id`, `name`, `email`, `phone`, `created_at`) VALUES (512, 'deco dog', 'decodude121@gmail.com', NULL, '2026-04-26 18:30:00');
INSERT INTO `user` (`user_id`, `name`, `email`, `phone`, `created_at`) VALUES (584, 'Mystic GAMER', 'sbhaduri214@gmail.com', NULL, '2026-04-29 18:30:00');

INSERT INTO `watchlist` (`watchlist_id`, `user_id`, `asset_id`) VALUES (2, 1, 4);
INSERT INTO `watchlist` (`watchlist_id`, `user_id`, `asset_id`) VALUES (1, 1, 5);
INSERT INTO `watchlist` (`watchlist_id`, `user_id`, `asset_id`) VALUES (3, 2, 6);
INSERT INTO `watchlist` (`watchlist_id`, `user_id`, `asset_id`) VALUES (9, 3, 12);
INSERT INTO `watchlist` (`watchlist_id`, `user_id`, `asset_id`) VALUES (10, 3, 16);

