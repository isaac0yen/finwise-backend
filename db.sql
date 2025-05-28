CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `gender` enum('MALE','FEMALE') NOT NULL,
  `dob` date NOT NULL,
  `nin` varchar(20) NOT NULL,
  `photo` longtext,
  `address` text,
  `state_of_origin` varchar(100) DEFAULT NULL,
  `ngn_balance` decimal(15,2) DEFAULT '0.00',
  `email_verified` tinyint(1) DEFAULT '0',
  `is_admin` tinyint(1) DEFAULT '0',
  `user_tag` varchar(4) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('ACTIVE','INACTIVE','DELETED','PENDING','EXPIRED') DEFAULT 'PENDING',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_UNIQUE` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `symbol` varchar(20) NOT NULL,
  `institution` varchar(255) NOT NULL,
  `total_supply` decimal(36,18) NOT NULL,
  `circulating_supply` decimal(36,18) NOT NULL,
  `initial_price` decimal(18,8) NOT NULL,
  `decimals` int DEFAULT '18',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `symbol_UNIQUE` (`symbol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `wallets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `naira_balance` decimal(18,2) DEFAULT '0.00',
  `phone_number` varchar(20) DEFAULT NULL,
  `phone_verified` tinyint(1) DEFAULT '0',
  `total_invested` decimal(18,2) DEFAULT '0.00',
  `realized_profits` decimal(18,2) DEFAULT '0.00',
  `total_fees_paid` decimal(18,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `wallet_user_unique` (`user_id`),
  CONSTRAINT `wallets_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `token_balances` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token_id` int NOT NULL,
  `balance` decimal(36,18) DEFAULT '0.000000000000000000',
  `average_buy_price` decimal(18,8) DEFAULT '0.00000000',
  `total_invested` decimal(18,8) DEFAULT '0.00000000',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_token_unique` (`user_id`, `token_id`),
  KEY `token_balances_token_id_fk` (`token_id`),
  CONSTRAINT `token_balances_token_id_fk` FOREIGN KEY (`token_id`) REFERENCES `tokens` (`id`) ON DELETE CASCADE,
  CONSTRAINT `token_balances_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `token_markets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `token_id` int NOT NULL,
  `price` decimal(18,8) NOT NULL,
  `volume` decimal(36,18) DEFAULT '0.000000000000000000',
  `liquidity_pool` decimal(36,18) DEFAULT '0.000000000000000000',
  `volatility` decimal(10,5) DEFAULT '0.00000',
  `sentiment` varchar(50) DEFAULT NULL,
  `price_change_24h` decimal(10,5) DEFAULT '0.00000',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_id_UNIQUE` (`token_id`),
  CONSTRAINT `token_markets_token_id_fk` FOREIGN KEY (`token_id`) REFERENCES `tokens` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `wallet_id` int NOT NULL,
  `type` enum('DEPOSIT','WITHDRAWAL','TRANSFER_SENT','TRANSFER_RECEIVED','BUY','SELL') NOT NULL,
  `amount` decimal(18,2) NOT NULL,
  `token_id` int DEFAULT NULL,
  `token_quantity` decimal(36,18) DEFAULT NULL,
  `token_price` decimal(18,8) DEFAULT NULL,
  `fee` decimal(18,2) DEFAULT '0.00',
  `profit_loss` decimal(18,2) DEFAULT '0.00',
  `related_user_id` int DEFAULT NULL,
  `status` enum('PENDING','COMPLETED','FAILED') DEFAULT 'PENDING',
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `transactions_wallet_id_idx` (`wallet_id`),
  KEY `transactions_token_id_idx` (`token_id`),
  KEY `transactions_created_at_idx` (`created_at`),
  KEY `token_type_idx` (`token_id`, `type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `pending_deposits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `wallet_id` int NOT NULL,
  `amount` decimal(18,2) NOT NULL,
  `paystack_reference` varchar(100) NOT NULL,
  `status` enum('PENDING','SUCCESS','FAILED') DEFAULT 'PENDING',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `pending_deposits_user_id_fk` (`user_id`),
  KEY `pending_deposits_wallet_id_fk` (`wallet_id`),
  CONSTRAINT `pending_deposits_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pending_deposits_wallet_id_fk` FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `pending_withdrawals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `wallet_id` int NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'NGN',
  `bank_name` varchar(255) NOT NULL,
  `account_number` varchar(50) NOT NULL,
  `account_name` varchar(255) NOT NULL,
  `rejection_reason` text,
  `status` enum('PENDING_REVIEW','APPROVED','REJECTED','PROCESSING','COMPLETED','FAILED') DEFAULT 'PENDING_REVIEW',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `pending_withdrawals_user_id_fk` (`user_id`),
  KEY `pending_withdrawals_wallet_id_fk` (`wallet_id`),
  CONSTRAINT `pending_withdrawals_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pending_withdrawals_wallet_id_fk` FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `verification_codes` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `code` varchar(20) NOT NULL,
  `type` varchar(50) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `verification_codes_user_id_fk` (`user_id`),
  CONSTRAINT `verification_codes_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` varchar(50) NOT NULL,
  `message` text NOT NULL,
  `read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `portfolio_snapshots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `total_invested` decimal(18,2) NOT NULL,
  `total_current_value` decimal(18,2) NOT NULL,
  `unrealized_profits` decimal(18,2) NOT NULL,
  `realized_profits` decimal(18,2) NOT NULL,
  `snapshot_date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_date_unique` (`user_id`, `snapshot_date`),
  KEY `portfolio_snapshots_date_idx` (`snapshot_date`),
  CONSTRAINT `portfolio_snapshots_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `market_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `effect_type` enum('BOOST','DROP','NEUTRAL') NOT NULL,
  `magnitude` decimal(10,5) NOT NULL,
  `tokens_affected` text NOT NULL,
  `start_time` timestamp NOT NULL,
  `end_time` timestamp NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `market_events_active_idx` (`is_active`),
  KEY `market_events_time_idx` (`start_time`, `end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `games` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `status` enum('ACTIVE','INACTIVE','PENDING') DEFAULT 'PENDING',
  `start_date` timestamp NULL DEFAULT NULL,
  `end_date` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Initial data for university tokens
INSERT INTO `tokens` (`name`, `symbol`, `institution`, `total_supply`, `circulating_supply`, `initial_price`, `decimals`) VALUES
('University of Lagos', 'UNILAG', 'University of Lagos', 1000000, 100000, 100, 18),
('University of Ilorin', 'UNILORIN', 'University of Ilorin', 950000, 95000, 95, 18),
('Obafemi Awolowo University', 'OAU', 'Obafemi Awolowo University', 800000, 80000, 110, 18),
('University of Ibadan', 'UI', 'University of Ibadan', 900000, 90000, 105, 18),
('University of Benin', 'UNIBEN', 'University of Benin', 750000, 75000, 85, 18),
('University of Nigeria Nsukka', 'UNN', 'University of Nigeria Nsukka', 850000, 85000, 90, 18),
('Ahmadu Bello University', 'ABU', 'Ahmadu Bello University', 1100000, 110000, 88, 18),
('University of Port Harcourt', 'UNIPORT', 'University of Port Harcourt', 700000, 70000, 92, 18),
('University of Calabar', 'UNICAL', 'University of Calabar', 600000, 60000, 80, 18),
('Federal University of Technology Owerri', 'FUTO', 'Federal University of Technology Owerri', 500000, 50000, 75, 18);

-- Initial market data for tokens
INSERT INTO `token_markets` (`token_id`, `price`, `volume`, `liquidity_pool`, `volatility`, `sentiment`, `price_change_24h`) VALUES
(1, 100, 0, 1000000, 0.05, 'NEUTRAL', 0),
(2, 95, 0, 902500, 0.05, 'NEUTRAL', 0),
(3, 110, 0, 880000, 0.05, 'NEUTRAL', 0),
(4, 105, 0, 945000, 0.05, 'NEUTRAL', 0),
(5, 85, 0, 637500, 0.05, 'NEUTRAL', 0),
(6, 90, 0, 765000, 0.05, 'NEUTRAL', 0),
(7, 88, 0, 968000, 0.05, 'NEUTRAL', 0),
(8, 92, 0, 644000, 0.05, 'NEUTRAL', 0),
(9, 80, 0, 480000, 0.05, 'NEUTRAL', 0),
(10, 75, 0, 375000, 0.05, 'NEUTRAL', 0);

-- Initial market events
INSERT INTO `market_events` (`name`, `description`, `effect_type`, `magnitude`, `tokens_affected`, `start_time`, `end_time`, `is_active`) VALUES
('New University Rankings Released', 'Annual university rankings have been published, boosting selected institutions.', 'BOOST', 0.08, '["UI", "UNILAG", "OAU"]', DATE_ADD(NOW(), INTERVAL -2 HOUR), DATE_ADD(NOW(), INTERVAL 10 HOUR), 1),
('Upcoming ASUU Meeting', 'An upcoming ASUU meeting is causing slight market concern.', 'DROP', 0.03, '["UNIBEN", "UNICAL", "FUTO"]', DATE_ADD(NOW(), INTERVAL -1 HOUR), DATE_ADD(NOW(), INTERVAL 5 HOUR), 1);
