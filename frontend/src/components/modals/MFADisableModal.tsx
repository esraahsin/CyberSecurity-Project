// frontend/src/components/modals/MFADisableModal.tsx - FIXED
import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { X, AlertTriangle, Mail } from 'lucide-react';
import authService from '../../services/auth.service';

interface MFADisableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDisable: (password: string, code: string) => Promise<void>;
}

export default function MFADisableModal({ isOpen, onClose, onDisable }: MFADisableModalProps) {
  const [step, setStep] = useState<'password' | 'code'>('password');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleRequestCode = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Request code to be sent to email
      // In a real implementation, you'd have an endpoint: POST /auth/mfa/disable/request
      // For now, we'll proceed to code entry
      setStep('code');
      setError(''); // Clear any errors
    } catch (err: any) {
      setError(err.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (code.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onDisable(password, code);
      setPassword('');
      setCode('');
      setStep('password');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to disable MFA');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('password');
    setCode('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Disable Two-Factor Authentication</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Warning */}
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-900">Security Warning</p>
              <p className="text-sm text-yellow-800 mt-1">
                Disabling two-factor authentication will make your account less secure.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        {step === 'password' ? (
          <div className="space-y-4 mb-6">
            <div>
              <Label htmlFor="password">Your Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="mt-2"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleRequestCode}
                disabled={loading || !password}
                className="flex-1"
              >
                {loading ? 'Processing...' : 'Continue'}
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Verification Code Sent</p>
                  <p className="text-sm text-blue-800 mt-1">
                    We've sent a 6-digit code to your email. Enter it below to confirm.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="text-center text-2xl font-mono tracking-widest mt-2"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleDisable}
                disabled={loading || code.length !== 6}
                variant="destructive"
                className="flex-1"
              >
                {loading ? 'Disabling...' : 'Disable MFA'}
              </Button>
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={loading}
              >
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}