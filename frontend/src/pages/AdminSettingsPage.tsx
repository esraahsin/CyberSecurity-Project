// frontend/src/pages/AdminSettingsPage.tsx - FULLY FUNCTIONAL
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Settings, Save, AlertTriangle, Shield, RefreshCw } from 'lucide-react';
import adminService from '../services/admin.service';

interface SystemSettings {
  security?: {
    max_login_attempts?: { value: number };
    account_lock_duration?: { value: number };
    session_timeout?: { value: number };
    mfa_required?: { value: boolean };
    password_min_length?: { value: number };
  };
  transactions?: {
    daily_transfer_limit?: { value: number };
    max_transaction_amount?: { value: number };
    fraud_detection_enabled?: { value: boolean };
    fraud_threshold?: { value: number };
  };
  system?: {
    maintenance_mode?: { value: boolean };
    debug_mode?: { value: boolean };
    api_rate_limit?: { value: number };
  };
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [originalSettings, setOriginalSettings] = useState<SystemSettings>({});

  const [settings, setSettings] = useState({
    // Security Settings
    max_login_attempts: '5',
    account_lock_duration: '30',
    session_timeout: '24',
    mfa_required: false,
    password_min_length: '8',
    
    // Transaction Settings
    daily_transfer_limit: '10000',
    max_transaction_amount: '100000',
    fraud_detection_enabled: true,
    fraud_threshold: '70',
    
    // System Settings
    maintenance_mode: false,
    debug_mode: false,
    api_rate_limit: '100',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await adminService.getSettings();
      
      if (response.success && response.data) {
        setOriginalSettings(response.data);
        
        // Map API response to form state
        const apiSettings = response.data;
        setSettings({
          max_login_attempts: String(apiSettings.security?.max_login_attempts?.value || '5'),
          account_lock_duration: String(apiSettings.security?.account_lock_duration?.value || '30'),
          session_timeout: String(apiSettings.security?.session_timeout?.value || '24'),
          mfa_required: apiSettings.security?.mfa_required?.value || false,
          password_min_length: String(apiSettings.security?.password_min_length?.value || '8'),
          
          daily_transfer_limit: String(apiSettings.transactions?.daily_transfer_limit?.value || '10000'),
          max_transaction_amount: String(apiSettings.transactions?.max_transaction_amount?.value || '100000'),
          fraud_detection_enabled: apiSettings.transactions?.fraud_detection_enabled?.value ?? true,
          fraud_threshold: String(apiSettings.transactions?.fraud_threshold?.value || '70'),
          
          maintenance_mode: apiSettings.system?.maintenance_mode?.value || false,
          debug_mode: apiSettings.system?.debug_mode?.value || false,
          api_rate_limit: String(apiSettings.system?.api_rate_limit?.value || '100'),
        });
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async () => {
    setSuccess('');
    setError('');
    setSaving(true);

    try {
      // Prepare updates object
      const updates: Record<string, any> = {};
      
      // Only include changed values
      Object.entries(settings).forEach(([key, value]) => {
        updates[key] = value;
      });

      const response = await adminService.updateSettings(updates);
      
      if (response.success) {
        setSuccess('Settings saved and applied successfully!');
        await loadSettings(); // Reload to get updated values
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Failed to save settings');
      }
    } catch (err: any) {
      console.error('Save settings error:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all settings to default values? This cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      const response = await adminService.resetSettings();
      
      if (response.success) {
        setSuccess('Settings reset to defaults!');
        await loadSettings();
      } else {
        setError(response.error || 'Failed to reset settings');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset settings');
    } finally {
      setSaving(false);
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600 mt-1">Configure system-wide settings</p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Security Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="max_login_attempts">Max Login Attempts (1-10)</Label>
              <Input
                id="max_login_attempts"
                name="max_login_attempts"
                type="number"
                min="1"
                max="10"
                value={settings.max_login_attempts}
                onChange={handleChange}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Number of failed login attempts before account lock</p>
            </div>

            <div>
              <Label htmlFor="account_lock_duration">Account Lock Duration (minutes)</Label>
              <Input
                id="account_lock_duration"
                name="account_lock_duration"
                type="number"
                min="5"
                max="1440"
                value={settings.account_lock_duration}
                onChange={handleChange}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">How long accounts stay locked (5-1440 minutes)</p>
            </div>

            <div>
              <Label htmlFor="session_timeout">Session Timeout (hours)</Label>
              <Input
                id="session_timeout"
                name="session_timeout"
                type="number"
                min="1"
                max="168"
                value={settings.session_timeout}
                onChange={handleChange}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Session expiration time (1-168 hours)</p>
            </div>

            <div>
              <Label htmlFor="password_min_length">Min Password Length</Label>
              <Input
                id="password_min_length"
                name="password_min_length"
                type="number"
                min="6"
                max="128"
                value={settings.password_min_length}
                onChange={handleChange}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum password length (6-128 characters)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="mfa_required"
              name="mfa_required"
              type="checkbox"
              checked={settings.mfa_required}
              onChange={handleChange}
              className="w-4 h-4 rounded border-gray-300"
            />
            <Label htmlFor="mfa_required" className="cursor-pointer">
              Require MFA for all users (enforces 2FA globally)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Transaction Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="daily_transfer_limit">Daily Transfer Limit ($)</Label>
              <Input
                id="daily_transfer_limit"
                name="daily_transfer_limit"
                type="number"
                min="100"
                max="1000000"
                value={settings.daily_transfer_limit}
                onChange={handleChange}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Default daily limit per account ($100-$1,000,000)</p>
            </div>

            <div>
              <Label htmlFor="max_transaction_amount">Max Transaction Amount ($)</Label>
              <Input
                id="max_transaction_amount"
                name="max_transaction_amount"
                type="number"
                min="1"
                max="10000000"
                value={settings.max_transaction_amount}
                onChange={handleChange}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum single transaction ($1-$10,000,000)</p>
            </div>

            <div>
              <Label htmlFor="fraud_threshold">Fraud Detection Threshold (0-100)</Label>
              <Input
                id="fraud_threshold"
                name="fraud_threshold"
                type="number"
                min="0"
                max="100"
                value={settings.fraud_threshold}
                onChange={handleChange}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Score above this blocks transactions (0-100)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="fraud_detection_enabled"
              name="fraud_detection_enabled"
              type="checkbox"
              checked={settings.fraud_detection_enabled}
              onChange={handleChange}
              className="w-4 h-4 rounded border-gray-300"
            />
            <Label htmlFor="fraud_detection_enabled" className="cursor-pointer">
              Enable fraud detection system
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* System Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            System Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="api_rate_limit">API Rate Limit (per minute)</Label>
              <Input
                id="api_rate_limit"
                name="api_rate_limit"
                type="number"
                min="10"
                max="1000"
                value={settings.api_rate_limit}
                onChange={handleChange}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Requests per minute per IP (10-1000)</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <input
              id="maintenance_mode"
              name="maintenance_mode"
              type="checkbox"
              checked={settings.maintenance_mode}
              onChange={handleChange}
              className="w-4 h-4 rounded border-gray-300"
            />
            <Label htmlFor="maintenance_mode" className="cursor-pointer">
              Enable maintenance mode (blocks all user access)
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="debug_mode"
              name="debug_mode"
              type="checkbox"
              checked={settings.debug_mode}
              onChange={handleChange}
              className="w-4 h-4 rounded border-gray-300"
            />
            <Label htmlFor="debug_mode" className="cursor-pointer">
              Enable debug mode (verbose logging)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between gap-4">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={saving}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
        
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={loadSettings}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}