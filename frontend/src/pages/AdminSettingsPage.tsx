
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Settings, Save, AlertTriangle, Shield } from 'lucide-react';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [settings, setSettings] = useState({
    // Security Settings
    maxLoginAttempts: '5',
    accountLockDuration: '30',
    sessionTimeout: '24',
    mfaRequired: false,
    
    // Transaction Settings
    dailyTransferLimit: '10000',
    maxTransactionAmount: '100000',
    fraudDetectionEnabled: true,
    
    // System Settings
    maintenanceMode: false,
    debugMode: false,
  });

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
    setLoading(true);

    try {
      // TODO: Implement save settings API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccess('Settings saved successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

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
              <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
              <Input
                id="maxLoginAttempts"
                name="maxLoginAttempts"
                type="number"
                value={settings.maxLoginAttempts}
                onChange={handleChange}
              />
            </div>

            <div>
              <Label htmlFor="accountLockDuration">Account Lock Duration (minutes)</Label>
              <Input
                id="accountLockDuration"
                name="accountLockDuration"
                type="number"
                value={settings.accountLockDuration}
                onChange={handleChange}
              />
            </div>

            <div>
              <Label htmlFor="sessionTimeout">Session Timeout (hours)</Label>
              <Input
                id="sessionTimeout"
                name="sessionTimeout"
                type="number"
                value={settings.sessionTimeout}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="mfaRequired"
              name="mfaRequired"
              type="checkbox"
              checked={settings.mfaRequired}
              onChange={handleChange}
              className="w-4 h-4 rounded border-gray-300"
            />
            <Label htmlFor="mfaRequired" className="cursor-pointer">
              Require MFA for all users
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
              <Label htmlFor="dailyTransferLimit">Daily Transfer Limit ($)</Label>
              <Input
                id="dailyTransferLimit"
                name="dailyTransferLimit"
                type="number"
                value={settings.dailyTransferLimit}
                onChange={handleChange}
              />
            </div>

            <div>
              <Label htmlFor="maxTransactionAmount">Max Transaction Amount ($)</Label>
              <Input
                id="maxTransactionAmount"
                name="maxTransactionAmount"
                type="number"
                value={settings.maxTransactionAmount}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="fraudDetectionEnabled"
              name="fraudDetectionEnabled"
              type="checkbox"
              checked={settings.fraudDetectionEnabled}
              onChange={handleChange}
              className="w-4 h-4 rounded border-gray-300"
            />
            <Label htmlFor="fraudDetectionEnabled" className="cursor-pointer">
              Enable fraud detection
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
          <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <input
              id="maintenanceMode"
              name="maintenanceMode"
              type="checkbox"
              checked={settings.maintenanceMode}
              onChange={handleChange}
              className="w-4 h-4 rounded border-gray-300"
            />
            <Label htmlFor="maintenanceMode" className="cursor-pointer">
              Enable maintenance mode
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="debugMode"
              name="debugMode"
              type="checkbox"
              checked={settings.debugMode}
              onChange={handleChange}
              className="w-4 h-4 rounded border-gray-300"
            />
            <Label htmlFor="debugMode" className="cursor-pointer">
              Enable debug mode
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <Button variant="outline">
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? (
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
  );
}
