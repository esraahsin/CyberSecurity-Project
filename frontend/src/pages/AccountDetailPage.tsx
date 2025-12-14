// ============================================
// FIX 1: frontend/src/pages/AccountDetailPage.tsx
// Remplacer la méthode handleDownloadStatement
// ============================================

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowUpRight, ArrowDownLeft, ArrowLeft, Download, Snowflake, Calendar } from 'lucide-react';
import accountService from '../services/account.service';
import { Account, Transaction, AccountStats } from '../types';

// ✅ Modal pour sélectionner la période du relevé
const StatementModal = ({ 
  isOpen, 
  onClose, 
  onDownload 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onDownload: (startDate: string, endDate: string) => void;
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  useEffect(() => {
    if (isOpen) {
      // Par défaut: dernier mois
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      
      setEndDate(end.toISOString().split('T')[0]);
      setStartDate(start.toISOString().split('T')[0]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Download Statement</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Quick date ranges */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Quick Select:</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setMonth(start.getMonth() - 1);
                  setEndDate(end.toISOString().split('T')[0]);
                  setStartDate(start.toISOString().split('T')[0]);
                }}
                className="text-xs px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Last Month
              </button>
              <button
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setMonth(start.getMonth() - 3);
                  setEndDate(end.toISOString().split('T')[0]);
                  setStartDate(start.toISOString().split('T')[0]);
                }}
                className="text-xs px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Last 3 Months
              </button>
              <button
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setFullYear(start.getFullYear() - 1);
                  setEndDate(end.toISOString().split('T')[0]);
                  setStartDate(start.toISOString().split('T')[0]);
                }}
                className="text-xs px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Last Year
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => onDownload(startDate, endDate)}
            disabled={!startDate || !endDate}
            className="flex-1"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // ✅ State pour le modal de relevé
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [downloadingStatement, setDownloadingStatement] = useState(false);

  useEffect(() => {
    if (id) {
      loadAccountDetails();
      loadTransactions();
    }
  }, [id]);

  const loadAccountDetails = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await accountService.getAccountDetails(parseInt(id!));
      
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
      
      if (response.success && response.data) {
        const txData = response.data.transactions || response.data.data || [];
        setTransactions(Array.isArray(txData) ? txData : []);
      }
    } catch (err: any) {
      console.error('Failed to load transactions:', err);
    }
  };

  // ✅ FIX: Nouvelle méthode pour télécharger le relevé
  const handleDownloadStatement = async (startDate: string, endDate: string) => {
    if (!account) return;

    setDownloadingStatement(true);

    try {
      console.log('📥 Downloading statement...', { accountId: account.id, startDate, endDate });
      
      const response = await accountService.getStatement(account.id, {
        startDate,
        endDate
      });
      
      if (response.success && response.data) {
        // ✅ Générer un PDF à partir des données
        generateStatementPDF(response.data, account);
        setShowStatementModal(false);
      } else {
        alert(response.error || 'Failed to generate statement');
      }
    } catch (err: any) {
      console.error('Statement download error:', err);
      alert(err.message || 'Failed to download statement');
    } finally {
      setDownloadingStatement(false);
    }
  };

  // ✅ Générer le PDF du relevé
  const generateStatementPDF = (statementData: any, accountInfo: Account) => {
    // Créer le contenu HTML du relevé
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Account Statement - ${accountInfo.accountNumber}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              border-bottom: 3px solid #2563eb;
              padding-bottom: 20px;
            }
            .logo {
              font-size: 32px;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 10px;
            }
            .account-info {
              background: #f3f4f6;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 30px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
            }
            .label {
              font-weight: bold;
              color: #6b7280;
            }
            .value {
              color: #111827;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            th {
              background: #2563eb;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: 600;
            }
            td {
              padding: 10px 12px;
              border-bottom: 1px solid #e5e7eb;
            }
            tr:hover {
              background: #f9fafb;
            }
            .debit {
              color: #dc2626;
            }
            .credit {
              color: #16a34a;
            }
            .summary {
              background: #eff6ff;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #2563eb;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            }
            .total {
              font-size: 18px;
              font-weight: bold;
              padding-top: 10px;
              border-top: 2px solid #2563eb;
              margin-top: 10px;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 12px;
            }
            @media print {
              body {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">🏦 SecureBank</div>
            <h2>Account Statement</h2>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>

          <div class="account-info">
            <div class="info-row">
              <span class="label">Account Number:</span>
              <span class="value">${accountInfo.accountNumber}</span>
            </div>
            <div class="info-row">
              <span class="label">Account Type:</span>
              <span class="value">${accountInfo.accountType.toUpperCase()}</span>
            </div>
            <div class="info-row">
              <span class="label">Currency:</span>
              <span class="value">${accountInfo.currency}</span>
            </div>
            <div class="info-row">
              <span class="label">Statement Period:</span>
              <span class="value">
                ${new Date(statementData.period.startDate).toLocaleDateString()} - 
                ${new Date(statementData.period.endDate).toLocaleDateString()}
              </span>
            </div>
            <div class="info-row">
              <span class="label">Current Balance:</span>
              <span class="value" style="font-size: 18px; font-weight: bold; color: #2563eb;">
                ${formatCurrency(accountInfo.balance)}
              </span>
            </div>
          </div>

          <h3>Transaction History</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Reference</th>
                <th style="text-align: right;">Debit</th>
                <th style="text-align: right;">Credit</th>
                <th style="text-align: right;">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${statementData.transactions.map((tx: any) => `
                <tr>
                  <td>${new Date(tx.date).toLocaleDateString()}</td>
                  <td>${tx.description || 'N/A'}</td>
                  <td style="font-family: monospace; font-size: 11px;">${tx.reference}</td>
                  <td class="debit" style="text-align: right;">
                    ${tx.debit ? formatCurrency(tx.debit) : '-'}
                  </td>
                  <td class="credit" style="text-align: right;">
                    ${tx.credit ? formatCurrency(tx.credit) : '-'}
                  </td>
                  <td style="text-align: right; font-weight: 600;">
                    ${tx.balance ? formatCurrency(tx.balance) : '-'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary">
            <h3 style="margin-top: 0;">Summary</h3>
            <div class="summary-row">
              <span class="label">Opening Balance:</span>
              <span class="value">${formatCurrency(statementData.openingBalance)}</span>
            </div>
            <div class="summary-row">
              <span class="label">Total Debits (${statementData.summary.debitCount}):</span>
              <span class="debit">${formatCurrency(statementData.summary.totalDebits)}</span>
            </div>
            <div class="summary-row">
              <span class="label">Total Credits (${statementData.summary.creditCount}):</span>
              <span class="credit">${formatCurrency(statementData.summary.totalCredits)}</span>
            </div>
            <div class="summary-row total">
              <span>Closing Balance:</span>
              <span>${formatCurrency(statementData.closingBalance)}</span>
            </div>
          </div>

          <div class="footer">
            <p><strong>SecureBank</strong></p>
            <p>This is an electronically generated statement and does not require a signature.</p>
            <p>For any queries, please contact customer service.</p>
            <p>© ${new Date().getFullYear()} SecureBank. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    // ✅ Ouvrir dans une nouvelle fenêtre pour impression/téléchargement
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      
      // Attendre que le contenu soit chargé puis ouvrir la boîte de dialogue d'impression
      printWindow.onload = () => {
        printWindow.print();
      };
    }

    // Alternative: Télécharger directement en tant que HTML
    const blob = new Blob([html], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statement_${accountInfo.accountNumber}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
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
          {/* ✅ FIX: Bouton Statement qui ouvre le modal */}
          <Button 
            variant="outline" 
            onClick={() => setShowStatementModal(true)}
            disabled={downloadingStatement}
          >
            {downloadingStatement ? (
              <>
                <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Statement
              </>
            )}
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

      {/* ✅ Modal pour sélectionner la période */}
      <StatementModal
        isOpen={showStatementModal}
        onClose={() => setShowStatementModal(false)}
        onDownload={handleDownloadStatement}
      />

      {/* Reste du code inchangé... */}
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