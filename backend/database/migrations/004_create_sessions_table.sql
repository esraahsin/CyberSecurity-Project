-- Migration: Create sessions table
-- Description: Gestion des sessions utilisateurs avec sécurité renforcée

-- UP Migration
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Token management
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    
    -- Session info
    ip_address INET NOT NULL,
    user_agent TEXT,
    device_info JSONB,
    
    -- Geolocation
    country VARCHAR(100),
    city VARCHAR(100),
    coordinates POINT,
    
    -- Security
    is_active BOOLEAN DEFAULT true,
    is_suspicious BOOLEAN DEFAULT false,
    suspicious_reason TEXT,
    
    -- MFA
    mfa_verified BOOLEAN DEFAULT false,
    mfa_verified_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    
    CONSTRAINT valid_expiration CHECK (expires_at > created_at)
);

-- Index
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_session_id ON sessions(session_id);
CREATE INDEX idx_sessions_is_active ON sessions(is_active);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_last_activity ON sessions(last_activity);
CREATE INDEX idx_sessions_user_active ON sessions(user_id, is_active);

-- Fonction pour nettoyer les sessions expirées
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    UPDATE sessions 
    SET is_active = false 
    WHERE expires_at < CURRENT_TIMESTAMP AND is_active = true;
    
    -- Supprimer les sessions expirées depuis plus de 7 jours
    DELETE FROM sessions 
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Fonction pour limiter les sessions actives par utilisateur
CREATE OR REPLACE FUNCTION limit_user_sessions()
RETURNS TRIGGER AS $$
DECLARE
    session_count INTEGER;
    max_sessions INTEGER := 5;
BEGIN
    -- Compter les sessions actives de l'utilisateur
    SELECT COUNT(*) INTO session_count 
    FROM sessions 
    WHERE user_id = NEW.user_id 
    AND is_active = true 
    AND expires_at > CURRENT_TIMESTAMP;
    
    -- Si limite dépassée, désactiver les plus anciennes
    IF session_count >= max_sessions THEN
        UPDATE sessions 
        SET is_active = false 
        WHERE id IN (
            SELECT id FROM sessions 
            WHERE user_id = NEW.user_id 
            AND is_active = true 
            AND expires_at > CURRENT_TIMESTAMP
            ORDER BY last_activity ASC 
            LIMIT (session_count - max_sessions + 1)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_session_limit 
BEFORE INSERT ON sessions
FOR EACH ROW EXECUTE FUNCTION limit_user_sessions();

-- DOWN Migration
-- DROP TRIGGER IF EXISTS enforce_session_limit ON sessions;
-- DROP FUNCTION IF EXISTS limit_user_sessions();
-- DROP FUNCTION IF EXISTS cleanup_expired_sessions();
-- DROP TABLE IF EXISTS sessions CASCADE;