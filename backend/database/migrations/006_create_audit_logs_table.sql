-- Migration: Create audit_logs table
-- Description: Traçabilité complète de toutes les actions dans le système

-- UP Migration
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    
    -- Identification
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    
    -- Action
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id INTEGER,
    
    -- Détails
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'authentication', 'authorization', 'transaction', 'account_change', 
        'security_event', 'system_event', 'data_access', 'configuration_change'
    )),
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN (
        'debug', 'info', 'warning', 'error', 'critical'
    )),
    
    -- Données
    old_values JSONB,
    new_values JSONB,
    changes JSONB,
    
    -- Contexte de la requête
    ip_address INET,
    user_agent TEXT,
    request_method VARCHAR(10),
    request_path TEXT,
    request_body JSONB,
    response_status INTEGER,
    
    -- Sécurité
    is_suspicious BOOLEAN DEFAULT false,
    risk_score DECIMAL(5,2),
    risk_factors TEXT[],
    
    -- Métadonnées
    metadata JSONB,
    error_message TEXT,
    stack_trace TEXT,
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Performance
    execution_time_ms INTEGER
);

-- Index pour recherche et performance
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_suspicious ON audit_logs(is_suspicious) WHERE is_suspicious = true;
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Index composite pour requêtes fréquentes
CREATE INDEX idx_audit_logs_user_date ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_severity_date ON audit_logs(severity, created_at DESC) WHERE severity IN ('error', 'critical');

-- Fonction pour nettoyer les vieux logs (garde 1 an)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    -- Supprimer les logs de plus d'1 an (sauf critiques)
    DELETE FROM audit_logs 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 year'
    AND severity NOT IN ('critical', 'error');
    
    -- Garder les logs critiques pendant 3 ans
    DELETE FROM audit_logs 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '3 years'
    AND severity = 'critical';
END;
$$ LANGUAGE plpgsql;

-- Fonction pour logger automatiquement les changements sur les tables importantes
CREATE OR REPLACE FUNCTION log_table_changes()
RETURNS TRIGGER AS $$
DECLARE
    action_type TEXT;
    old_data JSONB;
    new_data JSONB;
BEGIN
    -- Déterminer le type d'action
    IF TG_OP = 'INSERT' THEN
        action_type := 'CREATE';
        new_data := to_jsonb(NEW);
        old_data := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        action_type := 'UPDATE';
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        action_type := 'DELETE';
        old_data := to_jsonb(OLD);
        new_data := NULL;
    END IF;
    
    -- Insérer dans audit_logs
    INSERT INTO audit_logs (
        action,
        resource_type,
        resource_id,
        event_type,
        severity,
        old_values,
        new_values
    ) VALUES (
        action_type,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        'data_access',
        'info',
        old_data,
        new_data
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Appliquer l'audit automatique sur les tables sensibles
CREATE TRIGGER audit_users_changes
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_accounts_changes
AFTER INSERT OR UPDATE OR DELETE ON accounts
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_transactions_changes
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- DOWN Migration
-- DROP TRIGGER IF EXISTS audit_users_changes ON users;
-- DROP TRIGGER IF EXISTS audit_accounts_changes ON accounts;
-- DROP TRIGGER IF EXISTS audit_transactions_changes ON transactions;
-- DROP FUNCTION IF EXISTS log_table_changes();
-- DROP FUNCTION IF EXISTS cleanup_old_audit_logs();
-- DROP TABLE IF EXISTS audit_logs CASCADE;