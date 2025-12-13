// frontend/src/services/admin.service.ts

import api from './api.service';
import { ApiResponse, PaginationParams, PaginatedResponse, User, Account, Transaction } from '../types';

interface DashboardStats {
  users: {
    total_users: number;
    active_users: number;
    suspended_users: number;
    new_users_week: number;
  };
  accounts: {
    total_accounts: number;
    total_balance: string;
    active_accounts: number;
  };
  transactions: {
    total_transactions: number;
    last_24h: number;
    pending: number;
    high_risk: number;
  };
  criticalLogs: any[];
}

interface AuditLog {
  id: number;
  userId?: number;
  user?: {
    email: string;
    username: string;
  };
  action: string;
  resourceType: string;
  resourceId?: number;
  eventType: string;
  severity: string;
  oldValues?: any;
  newValues?: any;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  isSuspicious: boolean;
  riskScore?: number;
  createdAt: string;
}

interface AuditStats {
  total: number;
  critical: number;
  errors: number;
  warnings: number;
  suspicious: number;
  securityEvents: number;
  transactions: number;
}

class AdminService {
  // Dashboard
  async getDashboard(): Promise<ApiResponse<DashboardStats>> {
    return api.get('/admin/dashboard');
  }

  async getStats(params?: { startDate?: string; endDate?: string }): Promise<ApiResponse<{ audit: AuditStats }>> {
    return api.get('/admin/stats', params);
  }

  // Users Management
  async listUsers(params?: PaginationParams & { status?: string; role?: string }): Promise<ApiResponse<PaginatedResponse<User>>> {
    return api.get('/users', params);
  }

  async getUserById(userId: number): Promise<ApiResponse<{ user: User }>> {
    return api.get(`/users/${userId}`);
  }

  async updateUserRole(userId: number, role: string): Promise<ApiResponse<{ id: number; email: string; role: string }>> {
    return api.put(`/users/${userId}/role`, { role });
  }

  async updateUserStatus(userId: number, status: string): Promise<ApiResponse<{ id: number; email: string; account_status: string }>> {
    return api.put(`/users/${userId}/status`, { status });
  }

  async unlockUser(userId: number): Promise<ApiResponse<{ id: number; email: string }>> {
    return api.post(`/users/${userId}/unlock`);
  }

  async resetUserPassword(userId: number): Promise<ApiResponse<{ temporaryPassword: string; note: string }>> {
    return api.post(`/users/${userId}/reset-password`);
  }

  async searchUsers(query: string, params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<User>>> {
    return api.get('/users/search', { q: query, ...params });
  }

  async getUserAccounts(userId: number): Promise<ApiResponse<{ accounts: Account[]; total: number }>> {
    return api.get(`/users/${userId}/accounts`);
  }

  async getUserStats(userId: number): Promise<ApiResponse<{ stats: any }>> {
    return api.get(`/users/${userId}/stats`);
  }

  // Accounts Management
  async listAllAccounts(params?: PaginationParams & { status?: string; accountType?: string }): Promise<ApiResponse<PaginatedResponse<Account>>> {
    // This would need a new admin endpoint to list ALL accounts across all users
    // For now, you might need to add this to backend/src/routes/admin.routes.js
    return api.get('/admin/accounts', params);
  }

  // Audit Logs
  async getAuditLogs(params?: PaginationParams & {
    userId?: number;
    action?: string;
    eventType?: string;
    severity?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{ logs: AuditLog[]; pagination: any }>> {
    return api.get('/admin/audit-logs', params);
  }

  async getCriticalLogs(): Promise<ApiResponse<{ logs: AuditLog[]; pagination: any }>> {
    return api.get('/admin/audit-logs/critical');
  }

  async cleanupAuditLogs(daysToKeep: number): Promise<ApiResponse<{ deletedCount: number }>> {
    return api.delete('/admin/audit-logs/cleanup', { daysToKeep });
  }

  // System Health
  async getSystemHealth(): Promise<ApiResponse<{
    status: string;
    database: {
      status: string;
      timestamp: string;
    };
    uptime: number;
    memory: any;
    nodeVersion: string;
  }>> {
    return api.get('/admin/system/health');
  }

  // Reports
  async getDailyReport(date?: string): Promise<ApiResponse<{
    date: string;
    total_transactions: number;
    total_amount: string;
    completed: number;
    failed: number;
  }>> {
    return api.get('/admin/reports/daily', { date });
  }

  // Transactions (Admin view)
  async listAllTransactions(params?: PaginationParams & { type?: string; status?: string }): Promise<ApiResponse<PaginatedResponse<Transaction>>> {
    // This would need a new admin endpoint
    return api.get('/admin/transactions', params);
  }
}

const adminService = new AdminService();
export default adminService;