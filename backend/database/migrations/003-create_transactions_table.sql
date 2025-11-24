-- Migration: Create transactions table
-- Description: Historique complet des transactions avec traçabilité

-- UP Migration
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    
    -- Comptes source et destination
    from_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    to_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    
    -- Détails de la transaction
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'transfer', 'deposit', 'withdrawal', 'payment', 'refund', 'fee'
    )),
    amount BIGINT NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Description et références
    description TEXT,
    reference_number VARCHAR(100),
    
    -- Status et sécurité
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed'
    )),
    
    -- Détection de fraude
    fraud_score DECIMAL(5,2),
    fraud_checked BOOLEAN DEFAULT false,
    fraud_reason TEXT,
    
    -- Métadonnées
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    geolocation JSONB,
    
    -- Balance avant/après pour audit
    from_balance_before BIGINT,
    from_balance_after BIGINT,
    to_balance_before BIGINT,
    to_balance_after BIGINT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Contraintes
    CONSTRAINT positive_amount CHECK (amount > 0),
    CONSTRAINT different_accounts CHECK (from_account_id IS NULL OR to_account_id IS NULL OR from_account_id != to_account_id)
);

-- Index pour performance
CREATE INDEX idx_transactions_from_account ON transactions(from_account_id);
CREATE INDEX idx_transactions_to_account ON transactions(to_account_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_fraud_score ON transactions(fraud_score) WHERE fraud_score > 50;
CREATE INDEX idx_transactions_transaction_id ON transactions(transaction_id);

-- Index composite pour recherches fréquentes
CREATE INDEX idx_transactions_account_date ON transactions(from_account_id, created_at DESC);
CREATE INDEX idx_transactions_status_date ON transactions(status, created_at DESC);

-- Fonction pour générer un ID de transaction unique
CREATE OR REPLACE FUNCTION generate_transaction_id()
RETURNS VARCHAR(50) AS $$
DECLARE
    new_id VARCHAR(50);
    exists_check INTEGER;
BEGIN
    LOOP
        -- Format: TXN-YYYYMMDD-XXXXXXXXXX
        new_id := 'TXN' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || 
                  LPAD(FLOOR(random() * 10000000000)::TEXT, 10, '0');
        
        SELECT COUNT(*) INTO exists_check FROM transactions WHERE transaction_id = new_id;
        
        EXIT WHEN exists_check = 0;
    END LOOP;
    
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- DOWN Migration
-- DROP FUNCTION IF EXISTS generate_transaction_id();
-- DROP TABLE IF EXISTS transactions CASCADE;