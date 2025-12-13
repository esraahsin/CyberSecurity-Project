// frontend/src/pages/AccountDetailPage.tsx - FIXED VERSION
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowUpRight, ArrowDownLeft, ArrowLeft, Download, Snowflake } from 'lucide-react';
import accountService from '../services/account.service';
import { Account, Transaction, AccountStats } from '../types';

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadAccountDetails();
      loadTransactions();
    }
  }, [id]);

  const loadAccountDetails = async () => {
    try {
      setLoading(true);
      setError(''); // ✅ Clear previous errors
      
      const response = await accountService.getAccountDetails(parseInt(id!));
      
      console.log('Account details response:', response); // ✅ Debug log
      
      if (response.success && response.data) {
        setAccount(response.data.account);
        setStats(response.data.stats);
      } else {
        setError(response.error || 'Failed to load account');
      }
    } catch (err: any) {
      console.error('Failed to load account:', err);
      setError(err.message || 'Failed to load account');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const response = await accountService.getAccountTransactions(parseInt(id!), {
        page: 1,
        limit: 10,
      });
      
      console.log('Transactions response:', response); // ✅ Debug log
      
      if (response.success && response.data) {
        // ✅ FIX: Handle different response structures
        const txData = response.data.transactions || response.data.data || [];
        setTransactions(Array.isArray(txData) ? txData : []);
      }
    } catch (err: any) {
      console.error('Failed to load transactions:', err);
      // Don't set error here, just log it
    }
  };

  const handleFreezeAccount = async () => {
    if (!account || !window.confirm('Are you sure you want to freeze this account?')) return;

    try {
      const newStatus = account.accountStatus === 'active' ? 'frozen' : 'active';
      const response = await accountService.updateStatus(account.id, { status: newStatus });
      
      if (response.success) {
        loadAccountDetails();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update account status');
    }
  };

  const handleDownloadStatement = async () => {
    if (!account) return;

    try {
      const response = await accountService.getStatement(account.id);
      
      if (response.success && response.data) {
        alert('Statement generated successfully!');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate statement');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card">
          <p className="text-red-600">{error || 'Account not found'}</p>
          <Button onClick={() => navigate('/accounts')} className="mt-4">
            Back to Accounts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/accounts')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {account.accountType.toUpperCase()} Account
            </h1>
            <p className="text-gray-600 mt-1">{account.accountNumber}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadStatement}>
            <Download className="w-4 h-4 mr-2" />
            Statement
          </Button>
          <Button 
            variant="outline" 
            onClick={handleFreezeAccount}
            className={account.accountStatus === 'frozen' ? 'text-green-600' : 'text-orange-600'}
          >
            <Snowflake className="w-4 h-4 mr-2" />
            {account.accountStatus === 'frozen' ? 'Unfreeze' : 'Freeze'}
          </Button>
          <Button onClick={() => navigate('/transfer', { state: { fromAccountId: account.id } })}>
            <ArrowUpRight className="w-4 h-4 mr-2" />
            Transfer
          </Button>
        </div>
      </div>

      {/* Account Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-primary-500 to-primary-600 text-white">
          <CardHeader>
            <CardTitle className="text-white">Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold mb-2">{formatCurrency(account.balance)}</p>
            <div className="flex items-center justify-between text-primary-100">
              <span className="text-sm">Available: {formatCurrency(account.availableBalance)}</span>
              <span className={`text-xs px-2 py-1 rounded-full ${
                account.accountStatus === 'active' ? 'bg-green-500' : 'bg-yellow-500'
              } text-white`}>
                {account.accountStatus}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Account Type</p>
              <p className="font-medium">{account.accountType.toUpperCase()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Currency</p>
              <p className="font-medium">{account.currency}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Daily Transfer Limit</p>
              <p className="font-medium">{formatCurrency(account.dailyTransferLimit)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Monthly Transfer Limit</p>
              <p className="font-medium">{formatCurrency(account.monthlyTransferLimit)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Total Transactions</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalTransactions || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Total Debits</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{formatCurrency(stats.totalDebits || 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Total Credits</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{formatCurrency(stats.totalCredits || 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Last Transaction</p>
              <p className="text-lg font-medium text-gray-900 mt-2">
                {stats.lastTransactionDate 
                  ? new Date(stats.lastTransactionDate).toLocaleDateString()
                  : 'None'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Transactions</CardTitle>
            <Link to="/transactions" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View All
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {/* ✅ FIX: Check if transactions array exists and has length */}
          {!transactions || transactions.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No transactions yet</p>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${
                      transaction.direction === 'credit' 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {transaction.direction === 'credit' ? (
                        <ArrowDownLeft className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {transaction.description || transaction.type}
                      </p>
                      <p className="text-sm text-gray-500">{formatDate(transaction.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      transaction.direction === 'credit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.direction === 'credit' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      transaction.status === 'completed' ? 'bg-green-100 text-green-700' :
                      transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {transaction.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}