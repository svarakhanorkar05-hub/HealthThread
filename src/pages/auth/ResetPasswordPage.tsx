import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, HeartPulse, Lock, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.trim().length < 6) {
      setError('Password must be at least 6 non-space characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSuccess(true);
      window.setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-cream-50 via-teal-50/30 to-sage-50/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-700 text-white mb-4 shadow-soft">
            <HeartPulse className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
          <p className="text-slate-500 mt-2 text-sm">Set a new password for your HealthThread account.</p>
        </div>

        <div className="card p-6 sm:p-8 animate-slide-up">
          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm" role="alert">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-sage-50 border border-sage-100 text-sage-700 text-sm" role="status">
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Password updated. Redirecting you to your health dashboard…</span>
            </div>
          )}

          {!authLoading && !session ? (
            <div className="text-sm text-slate-600">
              This password reset link is invalid or has expired. Request a new link from the{' '}
              <button type="button" onClick={() => navigate('/forgot-password')} className="text-teal-700 font-medium hover:text-teal-800">
                password reset page
              </button>.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label" htmlFor="newPassword">New password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="newPassword"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="input pl-10"
                    placeholder="At least 6 characters"
                    disabled={authLoading || !session || loading || success}
                  />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="confirmPassword">Confirm new password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="input pl-10"
                    placeholder="Enter your new password again"
                    disabled={authLoading || !session || loading || success}
                  />
                </div>
              </div>
              <button type="submit" disabled={authLoading || !session || loading || success} className="btn-primary w-full">
                {loading ? 'Updating password...' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
