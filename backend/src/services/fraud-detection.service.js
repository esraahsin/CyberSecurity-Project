/**
 * Service de détection de fraude basique
 * @module services/fraud-detection.service
 */

const pool = require('../config/database');
const logger = require('../utils/logger');

class FraudDetectionService {
  /**
   * Calcule un score de risque pour une transaction
   * Score: 0-100 (0 = sûr, 100 = très risqué)
   */
  async calculateRiskScore(transaction) {
    let riskScore = 0;
    const riskFactors = [];
    
    const { fromAccountId, toAccountId, amount, ipAddress } = transaction;
    
    // 1. Montant inhabituellement élevé (0-30 points)
    const avgAmount = await this.getAverageTransactionAmount(fromAccountId);
    if (amount > avgAmount * 3) {
      const points = Math.min(30, Math.floor((amount / avgAmount) * 10));
      riskScore += points;
      riskFactors.push(`Montant ${Math.floor(amount / avgAmount)}x supérieur à la moyenne`);
    }
    
    // 2. Transactions multiples rapides (0-25 points)
    const recentCount = await this.getRecentTransactionCount(fromAccountId, 5); // 5 minutes
    if (recentCount > 3) {
      riskScore += 25;
      riskFactors.push(`${recentCount} transactions en 5 minutes`);
    }
    
    // 3. Nouveau bénéficiaire (0-15 points)
    const isNewRecipient = await this.isNewRecipient(fromAccountId, toAccountId);
    if (isNewRecipient) {
      riskScore += 15;
      riskFactors.push('Nouveau bénéficiaire');
    }
    
    // 4. Transaction hors heures habituelles (0-10 points)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      riskScore += 10;
      riskFactors.push('Transaction hors heures normales');
    }
    
    // 5. Changement d'adresse IP (0-20 points)
    const ipChanged = await this.hasIpChanged(fromAccountId, ipAddress);
    if (ipChanged) {
      riskScore += 20;
      riskFactors.push('Nouvelle adresse IP détectée');
    }
    
    return {
      riskScore: Math.min(100, riskScore),
      riskLevel: this.getRiskLevel(riskScore),
      riskFactors,
      shouldBlock: riskScore >= 70
    };
  }
  
  /**
   * Vérifie les activités suspectes
   */
  async checkSuspiciousActivity(accountId) {
    const suspicious = [];
    
    // 1. Tentatives de connexion multiples échouées
    const failedLogins = await this.getFailedLoginAttempts(accountId);
    if (failedLogins > 5) {
      suspicious.push({
        type: 'MULTIPLE_FAILED_LOGINS',
        severity: 'high',
        count: failedLogins
      });
    }
    
    // 2. Transactions vers de nombreux comptes différents
    const uniqueRecipients = await this.getUniqueRecipientsToday(accountId);
    if (uniqueRecipients > 10) {
      suspicious.push({
        type: 'MULTIPLE_RECIPIENTS',
        severity: 'medium',
        count: uniqueRecipients
      });
    }
    
    // 3. Montants ronds suspects (ex: 1000, 5000)
    const roundAmounts = await this.getRoundAmountTransactions(accountId);
    if (roundAmounts > 3) {
      suspicious.push({
        type: 'ROUND_AMOUNTS',
        severity: 'low',
        count: roundAmounts
      });
    }
    
    return {
      isSuspicious: suspicious.length > 0,
      alerts: suspicious,
      totalAlerts: suspicious.length
    };
  }
  
  /**
   * Valide les patterns de transaction
   */
  async validateTransactionPattern(accountId, amount) {
    const patterns = {
      valid: true,
      warnings: []
    };
    
    // 1. Vérifier le pattern temporel
    const last24h = await pool.query(`
      SELECT COUNT(*) as count, SUM(amount) as total
      FROM transactions
      WHERE from_account_id = $1
      AND created_at > NOW() - INTERVAL '24 hours'
      AND status = 'completed'
    `, [accountId]);
    
    const transactionsCount = parseInt(last24h.rows[0].count);
    const totalAmount = parseInt(last24h.rows[0].total || 0);
    
    if (transactionsCount > 20) {
      patterns.valid = false;
      patterns.warnings.push('Trop de transactions en 24h');
    }
    
    if (totalAmount + amount > 1000000) { // 10,000.00
      patterns.valid = false;
      patterns.warnings.push('Limite quotidienne dépassée');
    }
    
    // 2. Vérifier le pattern de montant
    if (amount > 500000) { // 5,000.00
      patterns.warnings.push('Montant élevé nécessite validation');
    }
    
    return patterns;
  }
  
  // --- Méthodes utilitaires privées ---
  
  async getAverageTransactionAmount(accountId) {
    const result = await pool.query(`
      SELECT COALESCE(AVG(amount), 10000) as avg
      FROM transactions
      WHERE from_account_id = $1
      AND created_at > NOW() - INTERVAL '30 days'
      AND status = 'completed'
    `, [accountId]);
    
    return parseInt(result.rows[0].avg);
  }
  
  async getRecentTransactionCount(accountId, minutes) {
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE from_account_id = $1
      AND created_at > NOW() - INTERVAL '${minutes} minutes'
    `, [accountId]);
    
    return parseInt(result.rows[0].count);
  }
  
  async isNewRecipient(fromAccountId, toAccountId) {
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE from_account_id = $1 AND to_account_id = $2
    `, [fromAccountId, toAccountId]);
    
    return parseInt(result.rows[0].count) === 0;
  }
  
  async hasIpChanged(accountId, currentIp) {
    const result = await pool.query(`
      SELECT ip_address
      FROM sessions
      WHERE user_id = (SELECT user_id FROM accounts WHERE id = $1)
      ORDER BY created_at DESC
      LIMIT 1
    `, [accountId]);
    
    if (result.rows.length === 0) return false;
    
    return result.rows[0].ip_address !== currentIp;
  }
  
  async getFailedLoginAttempts(accountId) {
    const result = await pool.query(`
      SELECT failed_login_attempts
      FROM users
      WHERE id = (SELECT user_id FROM accounts WHERE id = $1)
    `, [accountId]);
    
    return parseInt(result.rows[0]?.failed_login_attempts || 0);
  }
  
  async getUniqueRecipientsToday(accountId) {
    const result = await pool.query(`
      SELECT COUNT(DISTINCT to_account_id) as count
      FROM transactions
      WHERE from_account_id = $1
      AND DATE(created_at) = CURRENT_DATE
    `, [accountId]);
    
    return parseInt(result.rows[0].count);
  }
  
  async getRoundAmountTransactions(accountId) {
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE from_account_id = $1
      AND amount % 100000 = 0
      AND created_at > NOW() - INTERVAL '7 days'
    `, [accountId]);
    
    return parseInt(result.rows[0].count);
  }
  
  getRiskLevel(score) {
    if (score >= 70) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  }
}

module.exports = new FraudDetectionService();