import { useEffect, useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { HeartPulse, Menu, X, LogOut, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ToastContainer, useToast } from '@/components/Toast';
import { NAV_ITEMS } from '@/lib/constants';
import { calculateAge } from '@/lib/utils';

export function AppLayout() {
  const { user, profile, signOut } = useAuth();
  const { toasts, error, dismiss } = useToast();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (cause) {
      error(cause instanceof Error ? cause.message : 'Unable to sign out. Please try again.');
    }
  };

  const NavLinks = () => (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const showMenstrual = item.path !== '/menstrual' || profile?.menstrual_tracking_enabled;
        if (!showMenstrual) return null;
        const Icon: LucideIcon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-teal-50 hover:text-teal-700'
              }`
            }
          >
            <Icon className="w-4.5 h-4.5" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );

  const UserInfo = () => (
    <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-cream-100 border border-sage-100">
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-700 text-white text-sm font-semibold shrink-0">
        {(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 truncate">
          {profile?.full_name || 'Your Profile'}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {profile?.date_of_birth ? `${calculateAge(profile.date_of_birth)} years` : user?.email}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream-50">
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 h-dvh w-64 bg-white border-r border-slate-100 flex-col p-4 z-30">
        <div className="flex items-center gap-2.5 px-2 py-3 mb-6">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-teal-700 text-white">
            <HeartPulse className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold text-slate-900">HealthThread</span>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <NavLinks />
        </div>

        <div className="space-y-3 mt-4">
          <UserInfo />
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all w-full"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-slate-100 px-4 h-16 flex items-center justify-between z-30">
        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-teal-700 text-white">
            <HeartPulse className="w-4.5 h-4.5" />
          </div>
          <span className="font-bold text-slate-900">HealthThread</span>
        </div>
        <button
          type="button"
          aria-label="Open navigation menu"
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm animate-fade-in"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[min(18rem,calc(100vw-2rem))] bg-white p-4 flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-teal-700 text-white">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <span className="text-lg font-bold text-slate-900">HealthThread</span>
              </div>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <NavLinks />
            </div>

            <div className="space-y-3 mt-4">
              <UserInfo />
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all w-full"
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="lg:ml-64 min-w-0 pt-16 lg:pt-0 min-h-dvh">
        <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
