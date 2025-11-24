-- Migration: Create accounts table
-- Description: Comptes bancaires avec cryptage des données sensibles

-- UP Migration
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations du compte
    account_number VARCHAR(20) UNIQUE NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('checking', 'savings', 'business')),
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Solde (stocké en centimes pour éviter les erreurs de virgule flottante)
    balance BIGINT DEFAULT 0 NOT NULL,
    available_balance BIGINT DEFAULT 0 NOT NULL,
    
    -- Limites
    daily_transfer_limit BIGINT DEFAULT 500000, -- 5000.00 en centimes
    monthly_transfer_limit BIGINT DEFAULT 2000000, -- 20000.00 en centimes
    
    -- Sécurité
    account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'frozen', 'closed')),
    encryption_key_id VARCHAR(100),
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_transaction_at TIMESTAMP,
    
    -- Contraintes
    CONSTRAINT positive_balance CHECK (balance >= 0),
    CONSTRAINT positive_available_balance CHECK (available_balance >= 0)
);

-- Index
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_account_number ON accounts(account_number);
CREATE INDEX idx_accounts_status ON accounts(account_status);
CREATE INDEX idx_accounts_last_transaction ON accounts(last_transaction_at);

-- Trigger updated_at
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour générer un numéro de compte unique
CREATE OR REPLACE FUNCTION generate_account_number()
RETURNS VARCHAR(20) AS $$
DECLARE
    new_number VARCHAR(20);
    exists_check INTEGER;
BEGIN
    LOOP
        -- Format: BNK-XXXX-XXXX-XXXX (16 chiffres)
        new_number := 'BNK' || LPAD(FLOOR(random() * 10000)::TEXT, 4, '0') || 
                      LPAD(FLOOR(random() * 10000)::TEXT, 4, '0') || 
                      LPAD(FLOOR(random() * 10000)::TEXT, 4, '0');
        
        -- Vérifier si le numéro existe déjà
        SELECT COUNT(*) INTO exists_check FROM accounts WHERE account_number = new_number;
        
        EXIT WHEN exists_check = 0;
    END LOOP;
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- DOWN Migration
-- DROP FUNCTION IF EXISTS generate_account_number();
-- DROP TABLE IF EXISTS accounts CASCADE;