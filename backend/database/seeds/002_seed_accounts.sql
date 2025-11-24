-- Seed: Accounts
INSERT INTO accounts (user_id, account_number, account_type, currency, balance, available_balance)
VALUES
(1, 'BNK0001000100010001', 'checking', 'USD', 1000000, 1000000),  -- Alice: $10,000
(1, 'BNK0001000100010002', 'savings', 'USD', 5000000, 5000000),   -- Alice: $50,000
(2, 'BNK0002000200020001', 'checking', 'USD', 2000000, 2000000),  -- Bob: $20,000
(3, 'BNK0003000300030001', 'business', 'USD', 10000000, 10000000), -- Carol: $100,000
(4, 'BNK0004000400040001', 'checking', 'USD', 5000000, 5000000);  -- Admin: $50,000
