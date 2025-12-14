// frontend/src/pages/AdminUserDetailPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowLeft, User, CreditCard, Activity, Shield, Lock, Key } from 'lucide-react';
import adminService from '../services/admin.service';
import { User as UserType, Account } from '../types';

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserType | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadUserData();
    }
  }, [id]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      
      // Load user details
      const userResponse = await adminService.getUserById(parseInt(id!));
      if (userResponse.success && userResponse.data) {
        setUser(userResponse.data.user);
      }

      // Load user accounts
      const accountsResponse = await adminService.getUserAccounts(parseInt(id!));
      if (accountsResponse.success && accountsResponse.data) {
        setAccounts(accountsResponse.data.accounts);
      }

      // Load user stats
      const statsResponse = await adminService.getUserStats(parseInt(id!));
      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data.stats);
      }
    } catch (err: any) {
      console.error('Failed to load user data:', err);
      setError(err.message || 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (newRole: string) => {
    if (!user || !window.confirm(`Change user role to ${newRole}?`)) return;

    try {
      const response = await adminService.updateUserRole(user.id, newRole);
      if (response.success) {
        loadUserData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!user || !window.confirm(`Change user status to ${newStatus}?`)) return;

    try {
      const response = await adminService.updateUserStatus(user.id, newStatus);
      if (response.success) {
        loadUserData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleUnlockUser = async () => {
    if (!user || !window.confirm('Unlock this user account?')) return;

    try {
      const response = await adminService.unlockUser(user.id);
      if (response.success) {
        loadUserData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to unlock user');
    }
  };

  const handleResetPassword = async () => {
    if (!user || !window.confirm('Reset password for this user?')) return;

    try {
      const response = await adminService.resetUserPassword(user.id);
      if (response.success && response.data) {
        alert(`Temporary password: ${response.data.temporaryPassword}\n\n${response.data.note}`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-700';
      case 'locked':
        return 'bg-red-100 text-red-700';
      case 'closed':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700';
      case 'moderator':
        return 'bg-blue-100 text-blue-700';
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

  if (error || !user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card">
          <p className="text-red-600">{error || 'User not found'}</p>
          <Button onClick={() => navigate('/admin/users')} className="mt-4">
            Back to Users
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-gray-600 mt-1">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <span className={`text-xs px-3 py-1 rounded-full ${getStatusColor(user.account_status)}`}>
            {user.account_status}
          </span>
          <span className={`text-xs px-3 py-1 rounded-full ${getRoleColor(user.role)}`}>
            {user.role}
          </span>
        </div>
      </div>

      {/* User Info Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Accounts</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {accounts.length}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <CreditCard className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Balance</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {formatCurrency(accounts.reduce((sum, acc) => sum + acc.balance, 0))}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Activity className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Member Since</p>
                <p className="text-lg font-bold text-gray-900 mt-2">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <User className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600">Username</p>
              <p className="text-base font-medium text-gray-900 mt-1">{user.username}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="text-base font-medium text-gray-900 mt-1">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone Number</p>
              <p className="text-base font-medium text-gray-900 mt-1">{user.phoneNumber || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Date of Birth</p>
              <p className="text-base font-medium text-gray-900 mt-1">
                {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">MFA Enabled</p>
              <p className="text-base font-medium text-gray-900 mt-1">
                {user.mfaEnabled ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email Verified</p>
              <p className="text-base font-medium text-gray-900 mt-1">
                {user.emailVerified ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Last Login</p>
              <p className="text-base font-medium text-gray-900 mt-1">
                {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Created At</p>
              <p className="text-base font-medium text-gray-900 mt-1">
                {new Date(user.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Admin Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={() => handleUpdateRole(user.role === 'admin' ? 'user' : 'admin')}
            >
              <Shield className="w-4 h-4 mr-2" />
              {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
            </Button>

            {user.account_status === 'active' ? (
              <Button
                variant="outline"
                onClick={() => handleUpdateStatus('suspended')}
              >
                <Lock className="w-4 h-4 mr-2" />
                Suspend User
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => handleUpdateStatus('active')}
              >
                <Lock className="w-4 h-4 mr-2" />
                Activate User
              </Button>
            )}

            {user.account_status === 'locked' && (
              <Button
                variant="outline"
                onClick={handleUnlockUser}
              >
                <Lock className="w-4 h-4 mr-2" />
                Unlock User
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleResetPassword}
            >
              <Key className="w-4 h-4 mr-2" />
              Reset Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Accounts List */}
      <Card>
        <CardHeader>
          <CardTitle>User Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No accounts</p>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {account.accountType.toUpperCase()}
                    </p>
                    <p className="text-sm text-gray-500">{account.accountNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      {formatCurrency(account.balance)}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      account.accountStatus === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {account.accountStatus}
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