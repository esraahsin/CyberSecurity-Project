import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { X, Copy, Check } from 'lucide-react';

interface MFASetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  secret: string;
  onVerify: (code: string) => Promise<void>;
}

export default function MFASetupModal({ isOpen, onClose, secret, onVerify }: MFASetupModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Code must be 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onVerify(code);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Enable Two-Factor Authentication</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Instructions */}
        <div className="space-y-4 mb-6">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 font-medium mb-2">Setup Instructions:</p>
            <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
              <li>Install an authenticator app (Google Authenticator, Authy, etc.)</li>
              <li>Add a new account in the app</li>
              <li>Enter the secret key below or scan the QR code</li>
              <li>Enter the 6-digit code from your app to verify</li>
            </ol>
          </div>

          {/* Secret Key */}
          <div>
            <Label>Your Secret Key</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input
                value={secret}
                readOnly
                className="font-mono text-sm bg-gray-50"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopySecret}
                className="flex-shrink-0"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Keep this secret safe. You'll need it if you lose access to your authenticator app.
            </p>
          </div>

          {/* Verification Code */}
          <div>
            <Label htmlFor="mfa-code">Enter Verification Code</Label>
            <Input
              id="mfa-code"
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="text-center text-2xl font-mono tracking-widest mt-2"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className="flex-1"
          >
            {loading ? 'Verifying...' : 'Verify & Enable'}
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
    </div>
  );
}