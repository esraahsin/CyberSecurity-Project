// frontend/src/pages/admin/AdminUsersPage.tsx

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Search, Shield, Lock, Unlock, Key, Eye } from 'lucide-react';
import adminService from '../services/admin.service';
import { User } from '../types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    role: '',
  });

  useEffect(() => {
    if (searchQuery) {
      searchUsers();
    } else {
      loadUsers();
    }
  }, [page, filters]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await adminService.listUsers({
        page,
        limit: 20,
        status: filters.status || undefined,
        role: filters.role || undefined,
      });
      
      if (response.success && response.data) {
  setUsers(response.data.data || []);
  setTotalPages(response.data.pagination?.totalPages || 1);
} else {
  setUsers([]); // ✅ VERY IMPORTANT
  setError(response.error || 'Failed to load users');
}


    } catch (err: any) {
      console.error('Failed to load users:', err);
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }

  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      loadUsers();
      return;
    }

    try {
      setLoading(true);
      const response = await adminService.searchUsers(searchQuery, { page, limit: 20 });
      
      if (response.success && response.data) {
  setUsers(response.data.data || []);
  setTotalPages(response.data.pagination?.totalPages || 1);
} else {
  setUsers([]); // ✅ prevent undefined
}

    } catch (err: any) {
      console.error('Search failed:', err);
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    searchUsers();
  };

  const handleUpdateRole = async (userId: number, newRole: string) => {
    if (!window.confirm(`Change user role to ${newRole}?`)) return;

    try {
      const response = await adminService.updateUserRole(userId, newRole);
      if (response.success) {
        loadUsers();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    }
  };

  const handleUpdateStatus = async (userId: number, newStatus: string) => {
    if (!window.confirm(`Change user status to ${newStatus}?`)) return;

    try {
      const response = await adminService.updateUserStatus(userId, newStatus);
      if (response.success) {
        loadUsers();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleUnlockUser = async (userId: number) => {
    if (!window.confirm('Unlock this user account?')) return;

    try {
      const response = await adminService.unlockUser(userId);
      if (response.success) {
        loadUsers();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to unlock user');
    }
  };

  const handleResetPassword = async (userId: number) => {
    if (!window.confirm('Reset password for this user? They will receive a temporary password.')) return;

    try {
      const response = await adminService.resetUserPassword(userId);
      if (response.success && response.data) {
        alert(`Temporary password: ${response.data.temporaryPassword}\n\n${response.data.note}`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    }
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-600 mt-1">Manage all system users</p>
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
            <div className="relative col-span-2">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by name, email, username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>

            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="locked">Locked</option>
              <option value="closed">Closed</option>
            </select>

            <select
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
              className="input"
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
            </select>
          </div>

          <div className="mt-4">
            <Button onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
<CardTitle>Users ({users?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-900">{user.username}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(user.accountStatus)}`}>
                          {user.accountStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/admin/users/${user.id}`, '_blank')}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {user.accountStatus === 'locked' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnlockUser(user.id)}
                              title="Unlock User"
                            >
                              <Unlock className="w-4 h-4 text-green-600" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResetPassword(user.id)}
                            title="Reset Password"
                          >
                            <Key className="w-4 h-4 text-orange-600" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newRole = user.role === 'admin' ? 'user' : 'admin';
                              handleUpdateRole(user.id, newRole);
                            }}
                            title="Toggle Admin"
                          >
                            <Shield className={`w-4 h-4 ${user.role === 'admin' ? 'text-purple-600' : 'text-gray-400'}`} />
                          </Button>

                          {user.accountStatus === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUpdateStatus(user.id, 'suspended')}
                              title="Suspend User"
                            >
                              <Lock className="w-4 h-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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