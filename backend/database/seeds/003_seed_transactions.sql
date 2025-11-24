-- Seed: Transactions
INSERT INTO transactions (transaction_id, from_account_id, to_account_id, transaction_type, amount, currency, status, created_at, processed_at, completed_at)
VALUES
('TXN20251124A00001', 1, 2, 'transfer', 100000, 'USD', 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('TXN20251124A00002', 2, 1, 'transfer', 50000, 'USD', 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('TXN20251124A00003', NULL, 1, 'deposit', 200000, 'USD', 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('TXN20251124A00004', 3, 2, 'payment', 300000, 'USD', 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('TXN20251124A00005', 4, NULL, 'withdrawal', 100000, 'USD', 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
