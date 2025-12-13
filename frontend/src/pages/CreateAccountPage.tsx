// frontend/src/pages/CreateAccountPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowLeft, CreditCard } from 'lucide-react';
import accountService from '../services/account.service';

export default function CreateAccountPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    accountType: 'checking',
    currency: 'USD',
    initialBalance: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await accountService.createAccount({
        accountType: formData.accountType as 'checking' | 'savings' | 'business',
        currency: formData.currency,
        initialBalance: formData.initialBalance ? parseFloat(formData.initialBalance) : 0,
      });

      if (response.success) {
        navigate('/accounts', { 
          state: { message: 'Account created successfully!' }
        });
      } else {
        setError(response.error || 'Failed to create account');
      }
    } catch (err: any) {
      console.error('Account creation error:', err);
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => navigate('/accounts')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create New Account</h1>
          <p className="text-gray-600 mt-1">Open a new banking account</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <svg className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Account Type */}
            <div>
              <Label htmlFor="accountType">Account Type *</Label>
              <select
                id="accountType"
                name="accountType"
                required
                value={formData.accountType}
                onChange={handleChange}
                className="input mt-2"
              >
                <option value="checking">Checking Account</option>
                <option value="savings">Savings Account</option>
                <option value="business">Business Account</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {formData.accountType === 'checking' && 'For everyday transactions and payments'}
                {formData.accountType === 'savings' && 'For saving money with interest'}
                {formData.accountType === 'business' && 'For business operations'}
              </p>
            </div>

            {/* Currency */}
            <div>
              <Label htmlFor="currency">Currency *</Label>
              <select
                id="currency"
                name="currency"
                required
                value={formData.currency}
                onChange={handleChange}
                className="input mt-2"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
              </select>
            </div>

            {/* Initial Balance */}
            <div>
              <Label htmlFor="initialBalance">Initial Deposit (Optional)</Label>
              <div className="relative mt-2">
                <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                <Input
                  id="initialBalance"
                  name="initialBalance"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.initialBalance}
                  onChange={handleChange}
                  className="pl-8"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Minimum deposit: $0.00 • You can add funds later
              </p>
            </div>

            {/* Account Features */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Account Features</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>✓ Free account opening</li>
                <li>✓ No monthly maintenance fees</li>
                <li>✓ Online and mobile banking</li>
                <li>✓ Advanced fraud protection</li>
                <li>✓ 24/7 customer support</li>
              </ul>
            </div>

            {/* Terms */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-start">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  required
                  className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="terms" className="ml-2 text-sm text-gray-700">
                  I agree to the{' '}
                  <a href="/terms" className="text-primary-600 hover:text-primary-700">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" className="text-primary-600 hover:text-primary-700">
                    Privacy Policy
                  </a>
                </label>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/accounts')}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-medium text-green-800">Your Account is Protected</p>
            <p className="text-sm text-green-700 mt-1">
              All accounts are FDIC insured and protected with bank-grade security encryption.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}