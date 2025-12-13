// frontend/src/pages/ProfilePage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { User, Lock, Shield, LogOut } from 'lucide-react';
import authService from '../services/auth.service';

import MFASetupModal from '../components/modals/MFASetupModal';
import MFADisableModal from '../components/modals/MFADisableModal';

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Profile form
  const [profileData, setProfileData] = useState<{
    firstName: string;
    lastName: string;
    phoneNumber: string;
    email: string;
  }>({
    firstName: String(user?.firstName || ''),
    lastName: String(user?.lastName || ''),
    phoneNumber: String(user?.phoneNumber || ''),
    email: String(user?.email || ''),
  });

  // Password form
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: String(user.firstName || ''),
        lastName: String(user.lastName || ''),
        phoneNumber: String(user.phoneNumber || ''),
        email: String(user.email || ''),
      });
    }
  }, [user]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await authService.updateProfile(profileData);
      
      if (response.success && response.data) {
        updateUser(response.data);
        setSuccess('Profile updated successfully!');
      } else {
        setError(response.error || 'Failed to update profile');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.changePassword(passwordData);
      
      if (response.success) {
        setSuccess('Password changed successfully! You will be logged out.');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        
        // Logout after 2 seconds
        setTimeout(() => {
          logout();
        }, 2000);
      } else {
        setError(response.error || 'Failed to change password');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAllDevices = async () => {
    if (!window.confirm('This will log you out from all devices. Continue?')) return;

    try {
      await authService.terminateAllSessions();
      logout();
    } catch (err: any) {
      alert(err.message || 'Failed to logout from all devices');
    }
  };
   const [mfaSetupModal, setMfaSetupModal] = useState(false);
  const [mfaDisableModal, setMfaDisableModal] = useState(false);
  const [mfaSecret, setMfaSecret] = useState('');

  // Enable MFA handler
  const handleEnableMFA = async () => {
    try {
      setLoading(true);
      const response = await authService.enableMFA();
      
      if (response.success && response.data) {
        setMfaSecret(response.data.secret);
        setMfaSetupModal(true);
      } else {
        setError(response.error || 'Failed to setup MFA');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to setup MFA');
    } finally {
      setLoading(false);
    }
  };

  // Verify MFA code handler
  const handleVerifyMFA = async (code: string) => {
    const response = await authService.verifyMFACode(code);
    
    if (response.success) {
      setSuccess('Two-factor authentication enabled successfully!');
      // Update user state
      if (user) {
        updateUser({ ...user, mfaEnabled: true });
      }
    } else {
      throw new Error(response.error || 'Verification failed');
    }
  };

  // Disable MFA handler
  const handleDisableMFA = async (password: string, code: string) => {
    const response = await authService.disableMFA({ password, code });
    
    if (response.success) {
      setSuccess('Two-factor authentication disabled successfully!');
      // Update user state
      if (user) {
        updateUser({ ...user, mfaEnabled: false });
      }
    } else {
      throw new Error(response.error || 'Failed to disable MFA');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account information and security</p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
          <svg className="w-5 h-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-green-700">{success}</div>
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

      {/* User Info Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-primary-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {user?.firstName} {user?.lastName}
              </h3>
              <p className="text-gray-600">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  user?.account_status === 'active' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {user?.account_status}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={profileData.firstName}
                  onChange={handleProfileChange}
                  required
                />
              </div>

              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={profileData.lastName}
                  onChange={handleProfileChange}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={profileData.email}
                onChange={handleProfileChange}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={profileData.phoneNumber}
                onChange={handleProfileChange}
                placeholder="+1 (555) 000-0000"
              />
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                required
              />
            </div>

            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Must be at least 8 characters with uppercase, lowercase, numbers, and special characters
              </p>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                required
              />
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Actions */}
       {/* Account Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Account Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Multi-Factor Authentication</p>
              <p className="text-sm text-gray-600">
                {user?.mfaEnabled 
                  ? 'Extra security is enabled' 
                  : 'Add an extra layer of security'}
              </p>
            </div>
            <Button 
              variant="outline"
              onClick={user?.mfaEnabled ? () => setMfaDisableModal(true) : handleEnableMFA}
              disabled={loading}
            >
              {user?.mfaEnabled ? 'Disable' : 'Enable'}
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Active Sessions</p>
              <p className="text-sm text-gray-600">Manage your active sessions</p>
            </div>
            <Button variant="outline" onClick={handleLogoutAllDevices}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout All Devices
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
            <div>
              <p className="font-medium text-red-900">Delete Account</p>
              <p className="text-sm text-red-600">Permanently delete your account and data</p>
            </div>
            <Button variant="destructive">
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

<MFASetupModal
        isOpen={mfaSetupModal}
        onClose={() => setMfaSetupModal(false)}
        secret={mfaSecret}
        onVerify={handleVerifyMFA}
      />

      <MFADisableModal
        isOpen={mfaDisableModal}
        onClose={() => setMfaDisableModal(false)}
        onDisable={handleDisableMFA}
      />
    </div>
      );
}