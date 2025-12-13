// frontend/src/pages/admin/AdminDashboardPage.tsx

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Users, CreditCard, Activity, AlertTriangle, TrendingUp, Shield } from 'lucide-react';
import adminService from '../services/admin.service';

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await adminService.getDashboard();
      
      if (response.success && response.data) {
        setStats(response.data);
      } else {
        setError(response.error || 'Failed to load dashboard');
      }
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">System overview and management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Users */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats?.users?.total_users || 0}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  +{stats?.users?.new_users_week || 0} this week
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Users</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats?.users?.active_users || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats?.users?.suspended_users || 0} suspended
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Activity className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Accounts */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Accounts</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats?.accounts?.total_accounts || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats?.accounts?.active_accounts || 0} active
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <CreditCard className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Balance */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Balance</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {formatCurrency(stats?.accounts?.total_balance || 0)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Across all accounts</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <TrendingUp className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Total Transactions</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {stats?.transactions?.total_transactions || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Last 24 Hours</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {stats?.transactions?.last_24h || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600 mt-2">
              {stats?.transactions?.pending || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">High Risk</p>
            <p className="text-2xl font-bold text-red-600 mt-2">
              {stats?.transactions?.high_risk || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Logs */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Critical Events
            </CardTitle>
            <Link to="/admin/audit-logs" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View All Logs
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {stats?.criticalLogs && stats.criticalLogs.length > 0 ? (
            <div className="space-y-3">
              {stats.criticalLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="font-medium text-gray-900">{log.action}</p>
                      <p className="text-sm text-gray-600">
                        {log.user?.email || 'System'} • {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">
                    {log.severity}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No critical events</p>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/admin/users"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="bg-blue-100 p-3 rounded-full mb-2">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-900">Manage Users</span>
            </Link>

            <Link
              to="/admin/audit-logs"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="bg-purple-100 p-3 rounded-full mb-2">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-900">Audit Logs</span>
            </Link>

            <Link
              to="/admin/system"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="bg-green-100 p-3 rounded-full mb-2">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-900">System Health</span>
            </Link>

            <Link
              to="/admin/reports"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="bg-orange-100 p-3 rounded-full mb-2">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-sm font-medium text-gray-900">Reports</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}