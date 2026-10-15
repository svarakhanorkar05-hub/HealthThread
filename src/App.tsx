import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute, OnboardingGate } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/AppLayout';
import { SignUpPage } from '@/pages/auth/SignUpPage';
import { SignInPage } from '@/pages/auth/SignInPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { HealthRecordsPage } from '@/pages/HealthRecordsPage';
import { MedicationsPage } from '@/pages/MedicationsPage';
import { VaccinationsPage } from '@/pages/VaccinationsPage';
import { AppointmentsPage } from '@/pages/AppointmentsPage';
import { MenstrualPage } from '@/pages/MenstrualPage';
import { SettingsPage } from '@/pages/SettingsPage';

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/signup" element={<PublicRoute><SignUpPage /></PublicRoute>} />
      <Route path="/signin" element={<PublicRoute><SignInPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <OnboardingGate>
              <AppLayout />
            </OnboardingGate>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/records" element={<HealthRecordsPage />} />
        <Route path="/medications" element={<MedicationsPage />} />
        <Route path="/vaccinations" element={<VaccinationsPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/menstrual" element={<MenstrualPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
