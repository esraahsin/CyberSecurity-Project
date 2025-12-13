// frontend/src/pages/AccountsPage.tsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Plus, CreditCard, Eye, ArrowUpRight } from 'lucide-react';
import accountService from '../services/account.service';
import { Account } from '../types';

export default function AccountsPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await accountService.listAccounts();
      
      if (response.success && response.data) {
        setAccounts(response.data.accounts);
      } else {
        setError(response.error || 'Failed to load accounts');
      }
    } catch (err: any) {
      console.error('Failed to load accounts:', err);
      setError(err.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'checking':
        return 'bg-blue-100 text-blue-700';
      case 'savings':
        return 'bg-green-100 text-green-700';
      case 'business':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'frozen':
        return 'bg-yellow-100 text-yellow-700';
      case 'closed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
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
          <h1 className="text-3xl font-bold text-gray-900">My Accounts</h1>
          <p className="text-gray-600 mt-1">Manage your banking accounts</p>
        </div>
        <Button onClick={() => navigate('/accounts/new')} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          New Account
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Summary Card */}
      <div className="card mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-600">Total Accounts</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{accounts.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Balance</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {formatCurrency(accounts.reduce((sum, acc) => sum + acc.balance, 0))}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Available Balance</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {formatCurrency(accounts.reduce((sum, acc) => sum + acc.availableBalance, 0))}
            </p>
          </div>
        </div>
      </div>

      {/* Accounts Grid */}
      {accounts.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <CreditCard className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts yet</h3>
          <p className="text-gray-600 mb-4">Create your first account to get started</p>
          <Button onClick={() => navigate('/accounts/new')} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Create Account
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card 
              key={account.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => navigate(`/accounts/${account.id}`)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary-600" />
                    <span className="uppercase">{account.accountType}</span>
                  </CardTitle>
                  <span className={`text-xs px-2 py-1 rounded-full ${getAccountTypeColor(account.accountType)}`}>
                    {account.accountType}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Account Number */}
                <div>
                  <p className="text-xs text-gray-500">Account Number</p>
                  <p className="text-sm font-mono font-medium text-gray-900">
                    {account.accountNumber}
                  </p>
                </div>

                {/* Balance */}
                <div>
                  <p className="text-xs text-gray-500">Current Balance</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(account.balance)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Available: {formatCurrency(account.availableBalance)}
                  </p>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(account.accountStatus)}`}>
                    {account.accountStatus}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/accounts/${account.id}`);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/transfer', { state: { fromAccountId: account.id } });
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Last Activity */}
                {account.lastTransactionAt && (
                  <div className="text-xs text-gray-500">
                    Last activity: {new Date(account.lastTransactionAt).toLocaleDateString()}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-8 card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/transfer')}
            className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all"
          >
            <div className="bg-primary-100 p-3 rounded-full mb-2">
              <ArrowUpRight className="w-6 h-6 text-primary-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">Transfer Money</span>
          </button>

          <button
            onClick={() => navigate('/transactions')}
            className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all"
          >
            <div className="bg-purple-100 p-3 rounded-full mb-2">
              <Eye className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">View History</span>
          </button>

          <button
            onClick={() => navigate('/accounts/new')}
            className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all"
          >
            <div className="bg-green-100 p-3 rounded-full mb-2">
              <Plus className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">New Account</span>
          </button>

          <button
            onClick={() => navigate('/profile')}
            className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all"
          >
            <div className="bg-orange-100 p-3 rounded-full mb-2">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}