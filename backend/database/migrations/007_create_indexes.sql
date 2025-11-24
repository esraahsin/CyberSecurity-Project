-- Migration: Create additional indexes and optimizations
-- Description: Index supplémentaires pour optimiser les performances

-- ============================================
-- USERS - Index supplémentaires
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, account_status) 
WHERE account_status = 'active';

CREATE INDEX IF NOT EXISTS idx_users_mfa_enabled ON users(mfa_enabled) 
WHERE mfa_enabled = true;

-- Removed CURRENT_TIMESTAMP from WHERE
CREATE INDEX IF NOT EXISTS idx_users_locked_accounts ON users(account_locked_until);

CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- ============================================
-- ACCOUNTS - Index supplémentaires
-- ============================================
CREATE INDEX IF NOT EXISTS idx_accounts_user_type ON accounts(user_id, account_type);

CREATE INDEX IF NOT EXISTS idx_accounts_balance ON accounts(balance DESC);

CREATE INDEX IF NOT EXISTS idx_accounts_currency ON accounts(currency) 
WHERE account_status = 'active';

CREATE INDEX IF NOT EXISTS idx_accounts_account_number_pattern ON accounts 
USING btree(account_number varchar_pattern_ops);

-- ============================================
-- TRANSACTIONS - Index supplémentaires
-- ============================================
CREATE INDEX IF NOT EXISTS idx_transactions_pending ON transactions(status, created_at) 
WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_transactions_high_fraud ON transactions(fraud_score DESC, created_at DESC) 
WHERE fraud_score > 70;

CREATE INDEX IF NOT EXISTS idx_transactions_amount ON transactions(amount DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_from ON transactions(from_account_id, created_at DESC) 
WHERE from_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_to ON transactions(to_account_id, created_at DESC) 
WHERE to_account_id IS NOT NULL;

-- Removed functions from index expressions
CREATE INDEX IF NOT EXISTS idx_transactions_daily ON transactions(created_at, transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_monthly ON transactions(created_at);

-- ============================================
-- SESSIONS - Index supplémentaires
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expires_at) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sessions_suspicious ON sessions(user_id, is_suspicious, created_at) 
WHERE is_suspicious = true;

CREATE INDEX IF NOT EXISTS idx_sessions_ip ON sessions(ip_address, created_at DESC);

-- ============================================
-- BENEFICIARIES - Index supplémentaires
-- ============================================
CREATE INDEX IF NOT EXISTS idx_beneficiaries_favorites ON beneficiaries(user_id, is_favorite) 
WHERE is_favorite = true AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_beneficiaries_most_used ON beneficiaries(user_id, total_transfers DESC);

-- ============================================
-- AUDIT_LOGS - Index supplémentaires
-- ============================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_period_type ON audit_logs(
    created_at, 
    event_type
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_recent_errors ON audit_logs(created_at DESC) 
WHERE severity IN ('error', 'critical');

CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata ON audit_logs USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changes ON audit_logs USING gin(changes);

CREATE INDEX IF NOT EXISTS idx_audit_logs_risk ON audit_logs(risk_score DESC, created_at DESC) 
WHERE risk_score > 50;

-- ============================================
-- Removed recent/active volatile function indexes
-- ============================================
-- Transactions complétées dans les 90 derniers jours
CREATE INDEX IF NOT EXISTS idx_transactions_recent_completed ON transactions(created_at DESC) 
WHERE status = 'completed';

-- Sessions actives des dernières 24h
CREATE INDEX IF NOT EXISTS idx_sessions_recent_active ON sessions(last_activity DESC) 
WHERE is_active = true;

-- ============================================
-- VUES MATÉRIALISÉES pour rapports
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_transaction_stats AS
SELECT 
    DATE(created_at) as transaction_date,
    transaction_type,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    AVG(amount) as avg_amount,
    MAX(amount) as max_amount,
    COUNT(DISTINCT from_account_id) as unique_senders,
    COUNT(DISTINCT to_account_id) as unique_receivers,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
    AVG(fraud_score) FILTER (WHERE fraud_score IS NOT NULL) as avg_fraud_score
FROM transactions
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(created_at), transaction_type;

CREATE UNIQUE INDEX idx_daily_stats_date_type ON daily_transaction_stats(transaction_date, transaction_type);

CREATE MATERIALIZED VIEW IF NOT EXISTS user_activity_stats AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(DISTINCT s.id) as total_sessions,
    MAX(s.last_activity) as last_activity,
    COUNT(DISTINCT a.id) as account_count,
    SUM(a.balance) as total_balance,
    COUNT(DISTINCT t.id) as transaction_count,
    COALESCE(SUM(t.amount) FILTER (WHERE t.from_account_id IN (SELECT id FROM accounts WHERE user_id = u.id)), 0) as total_sent,
    COALESCE(SUM(t.amount) FILTER (WHERE t.to_account_id IN (SELECT id FROM accounts WHERE user_id = u.id)), 0) as total_received
FROM users u
LEFT JOIN sessions s ON u.id = s.user_id AND s.created_at >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN accounts a ON u.id = a.user_id AND a.account_status = 'active'
LEFT JOIN transactions t ON (t.from_account_id = a.id OR t.to_account_id = a.id) 
    AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
    AND t.status = 'completed'
WHERE u.account_status = 'active'
GROUP BY u.id, u.email;

CREATE UNIQUE INDEX idx_user_activity_user_id ON user_activity_stats(user_id);

CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_transaction_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_activity_stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STATISTIQUES pour l'optimiseur
-- ============================================
ANALYZE users;
ANALYZE accounts;
ANALYZE transactions;
ANALYZE sessions;
ANALYZE beneficiaries;
ANALYZE audit_logs;

-- ============================================
-- DOWN Migration
-- ============================================
-- DROP MATERIALIZED VIEW IF EXISTS daily_transaction_stats CASCADE;
-- DROP MATERIALIZED VIEW IF EXISTS user_activity_stats CASCADE;
-- DROP FUNCTION IF EXISTS refresh_materialized_views();
