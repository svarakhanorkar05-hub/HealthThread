import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, Mail, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function SignUpPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setConfirmationRequired(false);
    setLoading(true);

    try {
      if (!fullName.trim()) {
        setError('Please enter your name.');
        return;
      }
      if (password.trim().length < 6) {
        setError('Password must be at least 6 non-space characters.');
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (!data.session && data.user) {
        setConfirmationRequired(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create your account.');
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
          <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="text-slate-500 mt-2 text-sm">
            Your entire health journey, connected in one secure place.
          </p>
        </div>

        <div className="card p-6 sm:p-8 animate-slide-up">
          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {confirmationRequired && (
            <div className="mb-4 p-3 rounded-xl bg-sage-50 border border-sage-100 text-sage-700 text-sm" role="status">
              Account created. Check your email to confirm your address, then sign in to continue.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="fullName">Full name</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input pl-10"
                  placeholder="Jane Doe"
                />
              </div>
            </div>

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

            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="At least 6 characters"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/signin" className="text-teal-700 font-medium hover:text-teal-800">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Your health data is private and protected by row-level security.
        </p>
      </div>
    </div>
  );
}
