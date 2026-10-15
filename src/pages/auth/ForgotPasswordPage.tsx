import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, Mail, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send a password reset email.');
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
          <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
          <p className="text-slate-500 mt-2 text-sm">
            We'll send you a link to reset your password.
          </p>
        </div>

        <div className="card p-6 sm:p-8 animate-slide-up">
          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-sage-50 border border-sage-100 text-sage-700 text-sm">
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Reset link sent. Check your email inbox.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            <Link to="/signin" className="inline-flex items-center gap-1 text-teal-700 font-medium hover:text-teal-800">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
