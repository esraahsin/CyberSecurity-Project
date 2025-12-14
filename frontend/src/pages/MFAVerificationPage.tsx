// frontend/src/pages/MFAVerificationPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { OTPInput } from '../components/shared/OTPInput';
import { Shield, RefreshCw, ArrowLeft } from 'lucide-react';
import authService from '../services/auth.service';

interface LocationState {
  sessionId: string;
  email: string;
}

export default function MFAVerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateUser } = useAuth();
  
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const state = location.state as LocationState;
  const sessionId = state?.sessionId;
  const maskedEmail = state?.email;

  useEffect(() => {
    // Redirect if no session ID
    if (!sessionId) {
      navigate('/login', { replace: true });
    }
  }, [sessionId, navigate]);

  useEffect(() => {
    // Countdown timer for resend button
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleComplete = async (otp: string) => {
    setCode(otp);
    setError('');
    setLoading(true);

    try {
      const response = await authService.verifyMFALogin(sessionId, otp);
      
      if (response.success && response.data) {
        // Store tokens and user
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        updateUser(response.data.user);
        
        // Redirect based on role
        const redirectPath = response.data.user.role === 'admin' 
          ? '/admin/dashboard' 
          : '/dashboard';
        
        navigate(redirectPath, { replace: true });
      } else {
        setError(response.error || 'Invalid verification code');
        setCode('');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    
    setResendLoading(true);
    setResendSuccess(false);
    setError('');

    try {
      const response = await authService.resendMFACode(sessionId);
      
      if (response.success) {
        setResendSuccess(true);
        setCountdown(60); // 60 second cooldown
        setTimeout(() => setResendSuccess(false), 3000);
      } else {
        setError(response.error || 'Failed to resend code');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setResendLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card className="shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4 mx-auto">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              We've sent a verification code to<br />
              <span className="font-medium text-gray-900">{maskedEmail}</span>
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* OTP Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 text-center">
                Enter 6-Digit Code
              </label>
              <OTPInput
                length={6}
                onComplete={handleComplete}
                disabled={loading}
                error={!!error}
              />
              {error && (
                <p className="text-sm text-red-600 text-center">{error}</p>
              )}
            </div>

            {/* Resend Button */}
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={handleResend}
                disabled={resendLoading || countdown > 0}
                className="w-full"
              >
                {resendLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </>
                ) : countdown > 0 ? (
                  <>Resend code in {countdown}s</>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Resend Code
                  </>
                )}
              </Button>

              {resendSuccess && (
                <p className="text-sm text-green-600 text-center">
                  ✓ New code sent successfully!
                </p>
              )}
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-4">
                <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying...
                </div>
              </div>
            )}

            {/* Cancel Button */}
            <Button
              variant="ghost"
              onClick={handleCancel}
              className="w-full"
              disabled={loading}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>

            {/* Info Box */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Didn't receive the code?</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Check your spam/junk folder</li>
                    <li>Wait a few minutes for delivery</li>
                    <li>Click "Resend Code" to get a new one</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Having trouble?{' '}
            <a href="/support" className="text-primary-600 hover:text-primary-700 font-medium">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}