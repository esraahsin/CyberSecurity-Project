// src/pages/TransferPage.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import accountService from '../services/account.service';
import transactionService from '../services/transaction.service';
import { Account } from '../types';

const TransferPage: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    fromAccountId: '',
    toAccountNumber: '',
    amount: '',
    description: '',
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const response = await accountService.listAccounts();
      if (response.success && response.data) {
        setAccounts(response.data.accounts);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const response = await transactionService.createTransfer({
        fromAccountId: parseInt(formData.fromAccountId),
        toAccountNumber: formData.toAccountNumber,
        amount: parseFloat(formData.amount),
        description: formData.description,
      });

      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/transactions');
        }, 2000);
      } else {
        setError(response.error || 'Transfer failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find(acc => acc.id === parseInt(formData.fromAccountId));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Make a Transfer</h1>
        <p className="text-gray-600 mt-1">Send money to another account</p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
          <svg className="w-5 h-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-medium text-green-800">Transfer successful!</p>
            <p className="text-sm text-green-700 mt-1">Redirecting to transactions...</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <svg className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* From Account */}
          <div>
            <label htmlFor="fromAccountId" className="block text-sm font-medium text-gray-700 mb-2">
              From Account *
            </label>
            <select
              id="fromAccountId"
              name="fromAccountId"
              required
              value={formData.fromAccountId}
              onChange={handleChange}
              className="input"
            >
              <option value="">Select an account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountType.toUpperCase()} - {account.accountNumber} (Balance: ${account.balance.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {/* Available Balance Display */}
          {selectedAccount && (
            <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Available Balance</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${selectedAccount.availableBalance.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Daily Limit</p>
                  <p className="text-lg font-medium text-gray-900">
                    ${selectedAccount.dailyTransferLimit.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* To Account */}
          <div>
            <label htmlFor="toAccountNumber" className="block text-sm font-medium text-gray-700 mb-2">
              To Account Number *
            </label>
            <input
              id="toAccountNumber"
              name="toAccountNumber"
              type="text"
              required
              value={formData.toAccountNumber}
              onChange={handleChange}
              className="input"
              placeholder="BNK123456789012"
              pattern="BNK[0-9]{12,16}"
            />
            <p className="mt-1 text-xs text-gray-500">
              Format: BNK followed by 12-16 digits
            </p>
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
              Amount (USD) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                max="10000"
                required
                value={formData.amount}
                onChange={handleChange}
                className="input pl-8"
                placeholder="0.00"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Maximum: $10,000.00 per transfer
            </p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              className="input"
              placeholder="What is this transfer for?"
              maxLength={200}
            />
            <p className="mt-1 text-xs text-gray-500">
              {formData.description.length}/200 characters
            </p>
          </div>

          {/* Transfer Summary */}
          {formData.fromAccountId && formData.amount && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
              <h3 className="font-medium text-gray-900 mb-3">Transfer Summary</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Transfer Amount</span>
                <span className="font-medium text-gray-900">${parseFloat(formData.amount || '0').toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Fee</span>
                <span className="font-medium text-gray-900">$0.00</span>
              </div>
              <div className="pt-2 border-t border-gray-300 flex justify-between">
                <span className="font-medium text-gray-900">Total</span>
                <span className="font-bold text-gray-900">${parseFloat(formData.amount || '0').toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={loading || !formData.fromAccountId || !formData.toAccountNumber || !formData.amount}
              className="flex-1 btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                'Send Transfer'
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-secondary py-3"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Security Notice */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-800">Security Notice</p>
            <p className="text-sm text-blue-700 mt-1">
              All transfers are protected by advanced fraud detection. Verify the recipient account number before sending.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferPage;