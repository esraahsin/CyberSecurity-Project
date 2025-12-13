// frontend/src/pages/TransactionsPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowUpRight, ArrowDownLeft, Download, Filter, Search } from 'lucide-react';
import transactionService from '../services/transaction.service';
import { Transaction } from '../types';

export default function TransactionsPage() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    search: '',
  });

  useEffect(() => {
    loadTransactions();
  }, [page, filters]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const response = await transactionService.listTransactions({
        page,
        limit: 20,
        type: filters.type || undefined,
        status: filters.status || undefined,
      });
      
      if (response.success && response.data) {
        setTransactions(response.data.data || []);
        setTotalPages(response.data.pagination.totalPages);
      } else {
        setError(response.error || 'Failed to load transactions');
      }
    } catch (err: any) {
      console.error('Failed to load transactions:', err);
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await transactionService.exportTransactions();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Failed to export transactions');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeIcon = (direction: string) => {
    return direction === 'credit' ? (
      <ArrowDownLeft className="w-5 h-5" />
    ) : (
      <ArrowUpRight className="w-5 h-5" />
    );
  };

  const getTypeColor = (direction: string) => {
    return direction === 'credit'
      ? 'bg-green-100 text-green-600'
      : 'bg-red-100 text-red-600';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'processing':
        return 'bg-blue-100 text-blue-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      case 'cancelled':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredTransactions = transactions.filter(t => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        t.transactionId.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower) ||
        t.fromAccount?.toLowerCase().includes(searchLower) ||
        t.toAccount?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  if (loading && page === 1) {
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
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600 mt-1">View and manage your transaction history</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search transactions..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>

            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="input"
            >
              <option value="">All Types</option>
              <option value="transfer">Transfer</option>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="payment">Payment</option>
            </select>

            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input"
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <Button
              variant="outline"
              onClick={() => setFilters({ type: '', status: '', search: '' })}
            >
              <Filter className="w-4 h-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <ArrowUpRight className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
              <p className="text-gray-600 mb-4">
                {filters.search || filters.type || filters.status
                  ? 'Try adjusting your filters'
                  : 'Start by making your first transfer'}
              </p>
              {!filters.search && !filters.type && !filters.status && (
                <Button onClick={() => navigate('/transfer')}>
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  Make Transfer
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors cursor-pointer"
                  onClick={() => {
                    // Could navigate to transaction detail page
                    console.log('Transaction clicked:', transaction);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${getTypeColor(transaction.direction)}`}>
                      {getTypeIcon(transaction.direction)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {transaction.description || transaction.type.toUpperCase()}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <span>{formatDate(transaction.createdAt)}</span>
                        <span>•</span>
                        <span className="font-mono">{transaction.transactionId}</span>
                      </div>
                      {(transaction.fromAccount || transaction.toAccount) && (
                        <div className="text-xs text-gray-500 mt-1">
                          {transaction.direction === 'debit' && transaction.toAccount && (
                            <span>To: {transaction.toAccount}</span>
                          )}
                          {transaction.direction === 'credit' && transaction.fromAccount && (
                            <span>From: {transaction.fromAccount}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      transaction.direction === 'credit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.direction === 'credit' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(transaction.status)}`}>
                      {transaction.status}
                    </span>
                    {transaction.balanceAfter !== undefined && (
                      <p className="text-xs text-gray-500 mt-1">
                        Balance: {formatCurrency(transaction.balanceAfter)}
                      </p>
                    )}
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