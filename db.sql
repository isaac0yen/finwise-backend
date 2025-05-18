CREATE TABLE `games` (
  `id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `status` enum('ACTIVE','INACTIVE','PENDING') DEFAULT 'PENDING',
  `start_date` timestamp NULL DEFAULT NULL,
  `end_date` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `pending_deposits` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `wallet_id` int NOT NULL,
  `amount` decimal(18,2) NOT NULL,
  `paystack_reference` varchar(100) NOT NULL,
  `status` enum('PENDING','SUCCESS','FAILED') DEFAULT 'PENDING',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `pending_withdrawals` (
  `id` int NOT NULL,
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
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `tokens` (
  `id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `symbol` varchar(20) NOT NULL,
  `institution` varchar(255) NOT NULL,
  `total_supply` decimal(36,18) NOT NULL,
  `decimals` int DEFAULT '18',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `token_balances` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `token_id` int NOT NULL,
  `balance` decimal(36,18) DEFAULT '0.000000000000000000',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `token_markets` (
  `id` int NOT NULL,
  `token_id` int NOT NULL,
  `price` decimal(18,8) NOT NULL,
  `volume` decimal(36,18) DEFAULT '0.000000000000000000',
  `liquidity_pool` decimal(36,18) DEFAULT '0.000000000000000000',
  `volatility` decimal(10,5) DEFAULT '0.00000',
  `sentiment` varchar(50) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `transactions` (
  `id` int NOT NULL,
  `wallet_id` int NOT NULL,
  `type` enum('DEPOSIT','WITHDRAWAL','TRANSFER','BUY','SELL') NOT NULL,
  `amount` decimal(18,2) NOT NULL,
  `token_id` int DEFAULT NULL,
  `related_user_id` int DEFAULT NULL,
  `status` enum('PENDING','COMPLETED','FAILED') DEFAULT 'PENDING',
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `users` (
  `id` int NOT NULL,
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
  `usd_balance` decimal(15,2) DEFAULT '0.00',
  `email_verified` tinyint(1) DEFAULT '0',
  `is_admin` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('ACTIVE','INACTIVE','DELETED','PENDING') DEFAULT 'PENDING'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `verification_codes` (
  `id` bigint UNSIGNED NOT NULL,
  `user_id` int DEFAULT NULL,
  `code` varchar(20) NOT NULL,
  `type` varchar(50) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `wallets` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `naira_balance` decimal(18,2) DEFAULT '0.00',
  `usd_balance` decimal(18,2) DEFAULT '0.00',
  `phone_number` varchar(20) DEFAULT NULL,
  `phone_verified` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
