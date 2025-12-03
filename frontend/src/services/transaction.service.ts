// src/services/transaction.service.ts

import api from './api.service';
import { ApiResponse, Transaction, TransferRequest, PaginatedResponse, PaginationParams } from '../types';

interface DepositRequest {
  accountId: number;
  amount: number;
  description?: string;
}

interface WithdrawRequest {
  accountId: number;
  amount: number;
  description?: string;
}

interface DisputeRequest {
  reason: string;
  description: string;
}

interface TransactionStats {
  totalTransactions: number;
  totalAmount: number;
  averageAmount: number;
  largestTransaction: number;
}

class TransactionService {
  // Créer un transfert
  async createTransfer(data: TransferRequest): Promise<ApiResponse<{
    transactionId: string;
    fromAccount: string;
    toAccount: string;
    amount: number;
    currency: string;
    status: string;
    riskLevel: string;
  }>> {
    return api.post('/transactions/transfer', data);
  }

  // Créer un dépôt
  async createDeposit(data: DepositRequest): Promise<ApiResponse<{
    transactionId: string;
    accountNumber: string;
    amount: number;
    newBalance: number;
  }>> {
    return api.post('/transactions/deposit', data);
  }

  // Créer un retrait
  async createWithdrawal(data: WithdrawRequest): Promise<ApiResponse<{
    transactionId: string;
    accountNumber: string;
    amount: number;
    newBalance: number;
  }>> {
    return api.post('/transactions/withdraw', data);
  }

  // Liste toutes les transactions
  async listTransactions(
    params?: PaginationParams & { type?: string; status?: string }
  ): Promise<ApiResponse<PaginatedResponse<Transaction>>> {
    return api.get('/transactions', params);
  }

  // Récupérer une transaction par ID
  async getTransactionById(transactionId: number): Promise<ApiResponse<{ transaction: Transaction }>> {
    return api.get(`/transactions/${transactionId}`);
  }

  // Récupérer les transactions en attente
  async getPendingTransactions(): Promise<ApiResponse<{ transactions: Transaction[]; total: number }>> {
    return api.get('/transactions/pending');
  }

  // Récupérer les statistiques
  async getTransactionStats(params?: { period?: string; accountId?: number }): Promise<ApiResponse<{ stats: TransactionStats }>> {
    return api.get('/transactions/stats', params);
  }

  // Annuler une transaction
  async cancelTransaction(transactionId: number, reason?: string): Promise<ApiResponse<void>> {
    return api.post(`/transactions/${transactionId}/cancel`, { reason });
  }

  // Contester une transaction
  async disputeTransaction(transactionId: number, data: DisputeRequest): Promise<ApiResponse<{ dispute: any }>> {
    return api.post(`/transactions/${transactionId}/dispute`, data);
  }

  // Exporter les transactions en CSV
  async exportTransactions(params?: { startDate?: string; endDate?: string; accountId?: number }): Promise<Blob> {
    const response = await fetch(
      `${process.env.REACT_APP_API_URL || 'http://localhost:3000/api'}/transactions/export?` + 
      new URLSearchParams(params as any),
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.blob();
  }
}

const transactionService = new TransactionService();
export default transactionService;