// ============================================================
// FILE 1: frontend/src/pages/AdminAuditLogsPage.tsx
// ============================================================

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Search, Shield, AlertTriangle, Download, Filter } from 'lucide-react';
import adminService from '../services/admin.service';

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
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  isSuspicious: boolean;
  riskScore?: number;
  createdAt: string;
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    userId: '',
    action: '',
    eventType: '',
    severity: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    loadAuditLogs();
  }, [page, filters]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const response = await adminService.getAuditLogs({
        page,
        limit: 50,
        userId: filters.userId ? parseInt(filters.userId) : undefined,
        action: filters.action || undefined,
        eventType: filters.eventType || undefined,
        severity: filters.severity || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });
      
      if (response.success && response.data) {
        setLogs(response.data.logs);
        setTotalPages(response.data.pagination.totalPages);
      } else {
        setError(response.error || 'Failed to load audit logs');
      }
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700';
      case 'error':
        return 'bg-orange-100 text-orange-700';
      case 'warning':
        return 'bg-yellow-100 text-yellow-700';
      case 'info':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 mt-1">System activity and security events</p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Logs
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={filters.eventType}
              onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
              className="input"
            >
              <option value="">All Event Types</option>
              <option value="authentication">Authentication</option>
              <option value="authorization">Authorization</option>
              <option value="transaction">Transaction</option>
              <option value="security_event">Security Event</option>
              <option value="data_access">Data Access</option>
              <option value="configuration_change">Configuration Change</option>
            </select>

            <select
              value={filters.severity}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
              className="input"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search action..."
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={loadAuditLogs}>
              <Search className="w-4 h-4 mr-2" />
              Apply Filters
            </Button>
            <Button
              variant="outline"
              onClick={() => setFilters({
                userId: '',
                action: '',
                eventType: '',
                severity: '',
                startDate: '',
                endDate: '',
              })}
            >
              <Filter className="w-4 h-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No audit logs found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-4 border rounded-lg ${
                    log.isSuspicious ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`mt-1 p-2 rounded-lg ${
                        log.severity === 'critical' ? 'bg-red-100' :
                        log.severity === 'error' ? 'bg-orange-100' :
                        log.severity === 'warning' ? 'bg-yellow-100' :
                        'bg-blue-100'
                      }`}>
                        {log.isSuspicious ? (
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        ) : (
                          <Shield className="w-5 h-5 text-blue-600" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{log.action}</p>
                          <span className={`text-xs px-2 py-1 rounded-full ${getSeverityColor(log.severity)}`}>
                            {log.severity}
                          </span>
                        </div>

                        <div className="mt-1 text-sm text-gray-600">
                          <span>{log.resourceType}</span>
                          {log.resourceId && <span> #{log.resourceId}</span>}
                          {log.user && (
                            <span className="ml-2">
                              by <span className="font-medium">{log.user.email}</span>
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                          <span>{formatDate(log.createdAt)}</span>
                          {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                          {log.riskScore !== undefined && (
                            <span className="font-medium text-orange-600">
                              Risk Score: {log.riskScore}
                            </span>
                          )}
                        </div>

                        {log.metadata && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                              View metadata
                            </summary>
                            <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>

                    <span className={`text-xs px-2 py-1 rounded-full ${
                      log.eventType === 'security_event' ? 'bg-red-100 text-red-700' :
                      log.eventType === 'transaction' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {log.eventType}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}