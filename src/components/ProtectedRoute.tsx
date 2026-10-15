import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { HeartPulse } from 'lucide-react';
import { ErrorBanner } from '@/components/ErrorBanner';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-700 text-white animate-pulse">
            <HeartPulse className="w-6 h-6" />
          </div>
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}

export function OnboardingGate({ children }: { children: ReactNode }) {
  const { profile, profileError, loading, refreshProfile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-700 text-white animate-pulse">
            <HeartPulse className="w-6 h-6" />
          </div>
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50 p-4">
        <div className="w-full max-w-md space-y-4">
          <ErrorBanner message={profileError} />
          <button onClick={() => void refreshProfile()} className="btn-primary w-full">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profile || !profile.onboarding_completed) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
