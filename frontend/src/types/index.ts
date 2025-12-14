// frontend/src/types/index.ts - FIXED VERSION

import { ReactNode } from "react";

export interface User {
  id: number;
  email: string;
  username: string;
  firstName: string;        // ✅ camelCase
  lastName: string;         // ✅ camelCase
  phoneNumber?: string;     // ✅ camelCase
  dateOfBirth?: string;     // ✅ camelCase
  mfaEnabled: boolean;      // ✅ camelCase
  emailVerified: boolean;   // ✅ camelCase
  account_status: 'active' | 'suspended' | 'locked' | 'closed';
  role: 'user' | 'admin' | 'moderator';
  createdAt: string;        // ✅ camelCase
  lastLogin?: string;       // ✅ camelCase
}
export interface Account {
  id: number;
  accountNumber: string;
  accountType: 'checking' | 'savings' | 'business';
  currency: string;
  balance: number;
  availableBalance: number;
  accountStatus: 'active' | 'frozen' | 'closed';
  dailyTransferLimit: number;
  monthlyTransferLimit: number;
  createdAt: string;
  lastTransactionAt?: string;
}

export interface Transaction {
  id: number;
  transactionId: string;
  type: 'transfer' | 'deposit' | 'withdrawal';
  amount: number;
  currency: string;
  direction: 'debit' | 'credit';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  description?: string;
  fromAccount?: string;
  toAccount?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  createdAt: string;
  completedAt?: string;
}

export interface Session {
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  location?: {
    country?: string;
    city?: string;
  };
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
  isSuspicious: boolean;
  isExpiringSoon?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

// ✅ FIX: Generic PaginatedResponse that supports different field names
export interface PaginatedResponse<T> {
  data?: T[];              // For most endpoints
  transactions?: T[];      // For transaction endpoints
  users?: T[];            // For user endpoints  
  accounts?: T[];         // For account endpoints
  logs?: T[];             // For audit log endpoints
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TransferRequest {
  fromAccountId: number;
  toAccountNumber: string;
  amount: number;
  description?: string;
  currency?: string;
}

export interface AccountStats {
  totalTransactions: number;
  totalDebits: number;
  totalCredits: number;
  lastTransactionDate?: string;
}

export interface UserStats {
  totalAccounts: number;
  totalTransactions: number;
  totalBalance: number;
  lastLogin?: string;
}