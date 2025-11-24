-- Migration: Create beneficiaries table
-- Description: Gestion des bénéficiaires de transferts

-- UP Migration
CREATE TABLE IF NOT EXISTS beneficiaries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations du bénéficiaire
    beneficiary_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    bank_name VARCHAR(255),
    bank_code VARCHAR(20),
    swift_code VARCHAR(11),
    iban VARCHAR(34),
    
    -- Type et catégorie
    beneficiary_type VARCHAR(20) DEFAULT 'personal' CHECK (beneficiary_type IN ('personal', 'business', 'utility')),
    category VARCHAR(50), -- Ex: famille, fournisseur, etc.
    
    -- Vérification et sécurité
    is_verified BOOLEAN DEFAULT false,
    verification_method VARCHAR(50),
    verified_at TIMESTAMP,
    
    -- Limites personnalisées
    custom_daily_limit BIGINT,
    custom_monthly_limit BIGINT,
    
    -- Statut
    is_active BOOLEAN DEFAULT true,
    is_favorite BOOLEAN DEFAULT false,
    
    -- Métadonnées
    nickname VARCHAR(100),
    notes TEXT,
    
    -- Statistiques d'utilisation
    total_transfers INTEGER DEFAULT 0,
    total_amount_transferred BIGINT DEFAULT 0,
    last_transfer_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes
    CONSTRAINT unique_beneficiary_per_user UNIQUE(user_id, account_number),
    CONSTRAINT valid_iban CHECK (iban IS NULL OR LENGTH(iban) BETWEEN 15 AND 34)
);

-- Index
CREATE INDEX idx_beneficiaries_user_id ON beneficiaries(user_id);
CREATE INDEX idx_beneficiaries_account_number ON beneficiaries(account_number);
CREATE INDEX idx_beneficiaries_is_active ON beneficiaries(is_active);
CREATE INDEX idx_beneficiaries_is_favorite ON beneficiaries(is_favorite);
CREATE INDEX idx_beneficiaries_user_active ON beneficiaries(user_id, is_active);

-- Trigger updated_at
CREATE TRIGGER update_beneficiaries_updated_at BEFORE UPDATE ON beneficiaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour mettre à jour les statistiques après un transfert
CREATE OR REPLACE FUNCTION update_beneficiary_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        UPDATE beneficiaries 
        SET 
            total_transfers = total_transfers + 1,
            total_amount_transferred = total_amount_transferred + NEW.amount,
            last_transfer_at = NEW.completed_at
        WHERE id = (
            SELECT b.id FROM beneficiaries b
            INNER JOIN accounts a ON a.account_number = (
                SELECT account_number FROM accounts WHERE id = NEW.to_account_id
            )
            WHERE b.user_id = (
                SELECT user_id FROM accounts WHERE id = NEW.from_account_id
            )
            AND b.account_number = a.account_number
            LIMIT 1
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_beneficiary_statistics 
AFTER UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_beneficiary_stats();

-- DOWN Migration
-- DROP TRIGGER IF EXISTS update_beneficiary_statistics ON transactions;
-- DROP FUNCTION IF EXISTS update_beneficiary_stats();
-- DROP TABLE IF EXISTS beneficiaries CASCADE;