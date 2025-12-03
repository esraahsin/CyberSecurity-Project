// src/services/account.service.ts

import api from './api.service';
import { ApiResponse, Account, Transaction, PaginatedResponse, PaginationParams, AccountStats } from '../types';

interface CreateAccountRequest {
  accountType: 'checking' | 'savings' | 'business';
  currency?: string;
  initialBalance?: number;
}

interface UpdateLimitsRequest {
  dailyLimit?: number;
  monthlyLimit?: number;
}

interface UpdateStatusRequest {
  status: 'active' | 'frozen';
}

class AccountService {
  // Liste tous les comptes
  async listAccounts(): Promise<ApiResponse<{ accounts: Account[]; total: number }>> {
    return api.get('/accounts');
  }

  // Créer un nouveau compte
  async createAccount(data: CreateAccountRequest): Promise<ApiResponse<Account>> {
    return api.post('/accounts', data);
  }

  // Récupérer les détails d'un compte
  async getAccountDetails(accountId: number): Promise<ApiResponse<{ account: Account; stats: AccountStats }>> {
    return api.get(`/accounts/${accountId}`);
  }

  // Récupérer le solde
  async getBalance(accountId: number): Promise<ApiResponse<{
    accountId: number;
    accountNumber: string;
    balance: number;
    availableBalance: number;
    currency: string;
    asOf: string;
  }>> {
    return api.get(`/accounts/${accountId}/balance`);
  }

  // Récupérer les transactions d'un compte
  async getAccountTransactions(
    accountId: number,
    params?: PaginationParams & { type?: string; status?: string }
  ): Promise<ApiResponse<PaginatedResponse<Transaction>>> {
    return api.get(`/accounts/${accountId}/transactions`, params);
  }

  // Générer un relevé de compte
  async getStatement(
    accountId: number,
    params?: { startDate?: string; endDate?: string }
  ): Promise<ApiResponse<{
    account: {
      accountNumber: string;
      accountType: string;
      currency: string;
    };
    period: {
      startDate: string;
      endDate: string;
    };
    openingBalance: number;
    closingBalance: number;
    transactions: Array<{
      date: string;
      description: string;
      reference: string;
      debit: number | null;
      credit: number | null;
      balance: number | null;
    }>;
    summary: {
      totalTransactions: number;
      totalDebits: number;
      totalCredits: number;
      debitCount: number;
      creditCount: number;
    };
    generatedAt: string;
  }>> {
    return api.get(`/accounts/${accountId}/statement`, params);
  }

  // Mettre à jour les limites
  async updateLimits(accountId: number, data: UpdateLimitsRequest): Promise<ApiResponse<{
    accountId: number;
    dailyTransferLimit: number;
    monthlyTransferLimit: number;
  }>> {
    return api.put(`/accounts/${accountId}/limits`, data);
  }

  // Changer le statut du compte
  async updateStatus(accountId: number, data: UpdateStatusRequest): Promise<ApiResponse<{
    accountId: number;
    accountNumber: string;
    accountStatus: string;
  }>> {
    return api.put(`/accounts/${accountId}/status`, data);
  }

  // Fermer un compte
  async closeAccount(accountId: number): Promise<ApiResponse<{
    accountId: number;
    accountNumber: string;
    accountStatus: string;
  }>> {
    return api.delete(`/accounts/${accountId}`);
  }
}

export default new AccountService();