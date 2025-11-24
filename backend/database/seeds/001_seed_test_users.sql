-- Seed: Users
INSERT INTO users (email, username, password_hash, first_name, last_name, phone_number, date_of_birth, mfa_enabled, role)
VALUES
('alice@example.com', 'alice', 'password_hash_1', 'Alice', 'Smith', '+12345678901', '1990-01-01', false, 'user'),
('bob@example.com', 'bob', 'password_hash_2', 'Bob', 'Johnson', '+12345678902', '1985-05-15', true, 'user'),
('carol@example.com', 'carol', 'password_hash_3', 'Carol', 'Williams', '+12345678903', '1992-08-22', false, 'support'),
('admin@example.com', 'admin', 'password_hash_4', 'Admin', 'User', '+12345678904', '1980-01-01', true, 'admin');
