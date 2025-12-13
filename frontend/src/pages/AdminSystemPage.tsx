
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Activity, Database, Server, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import adminService from '../services/admin.service';

interface SystemHealth {
  status: string;
  database: {
    status: string;
    timestamp: string;
  };
  uptime: number;
  memory: any;
  nodeVersion: string;
}

export default function AdminSystemPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSystemHealth();
  }, []);

  const loadSystemHealth = async () => {
    try {
      setLoading(true);
      const response = await adminService.getSystemHealth();
      
      if (response.success && response.data) {
        setHealth(response.data);
      } else {
        setError(response.error || 'Failed to load system health');
      }
    } catch (err: any) {
      console.error('Failed to load system health:', err);
      setError(err.message || 'Failed to load system health');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadSystemHealth();
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatMemory = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
          <p className="text-gray-600 mt-1">Monitor system status and performance</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* System Status Overview */}
      {health && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Overall Status */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">System Status</p>
                    <p className="text-2xl font-bold text-green-600 mt-2">
                      {health.status}
                    </p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-lg">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Database Status */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Database</p>
                    <p className="text-2xl font-bold text-green-600 mt-2">
                      {health.database.status}
                    </p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Database className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Uptime */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Uptime</p>
                    <p className="text-lg font-bold text-gray-900 mt-2">
                      {formatUptime(health.uptime)}
                    </p>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <Activity className="w-8 h-8 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Node Version */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Node.js</p>
                    <p className="text-lg font-bold text-gray-900 mt-2">
                      {health.nodeVersion}
                    </p>
                  </div>
                  <div className="bg-orange-100 p-3 rounded-lg">
                    <Server className="w-8 h-8 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Memory Usage */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Memory Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">RSS</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {formatMemory(health.memory.rss)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Resident Set Size</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Heap Total</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {formatMemory(health.memory.heapTotal)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Total heap allocated</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Heap Used</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {formatMemory(health.memory.heapUsed)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Heap in use</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">External</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {formatMemory(health.memory.external)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">External memory</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Database Info */}
          <Card>
            <CardHeader>
              <CardTitle>Database Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Status</span>
                  <span className="text-sm text-green-600 font-medium">
                    {health.database.status}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Last Check</span>
                  <span className="text-sm text-gray-900">
                    {new Date(health.database.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
