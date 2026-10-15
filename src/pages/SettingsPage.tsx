import { useEffect, useState } from 'react';
import { User, Heart, Shield, Download, Trash2, Save, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast, ToastContainer } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { ErrorBanner } from '@/components/ErrorBanner';
import { BLOOD_TYPES } from '@/lib/constants';
import { calculateAge } from '@/lib/utils';

export function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { toasts, success, error, dismiss } = useToast();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth || '');
  const [biologicalSex, setBiologicalSex] = useState(profile?.biological_sex || '');
  const [bloodType, setBloodType] = useState(profile?.blood_type || '');
  const [heightCm, setHeightCm] = useState(profile?.height_cm?.toString() || '');
  const [weightKg, setWeightKg] = useState(profile?.weight_kg?.toString() || '');
  const [emergencyContactName, setEmergencyContactName] = useState(profile?.emergency_contact_name || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(profile?.emergency_contact_phone || '');
  const [menstrualTracking, setMenstrualTracking] = useState(profile?.menstrual_tracking_enabled || false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || '');
    setDateOfBirth(profile.date_of_birth || '');
    setBiologicalSex(profile.biological_sex || '');
    setBloodType(profile.blood_type || '');
    setHeightCm(profile.height_cm?.toString() || '');
    setWeightKg(profile.weight_kg?.toString() || '');
    setEmergencyContactName(profile.emergency_contact_name || '');
    setEmergencyContactPhone(profile.emergency_contact_phone || '');
    setMenstrualTracking(profile.menstrual_tracking_enabled);
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setFormError(null);

    const { error: updateError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: fullName.trim() || null,
        date_of_birth: dateOfBirth || null,
        biological_sex: biologicalSex || null,
        blood_type: bloodType || null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        emergency_contact_name: emergencyContactName.trim() || null,
        emergency_contact_phone: emergencyContactPhone.trim() || null,
        menstrual_tracking_enabled: menstrualTracking,
      }, { onConflict: 'id' });

    if (updateError) {
      setFormError(updateError.message);
      setSaving(false);
      return;
    }

    await refreshProfile();
    success('Profile updated successfully.');
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!user?.email || deleteConfirm !== 'DELETE' || !deletePassword) return;
    setSaving(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword,
      });
      if (reauthError) {
        error('Password confirmation failed. Check your password and try again.');
        return;
      }

      const { error: deletionError } = await supabase.functions.invoke('delete-account');
      if (deletionError) {
        error(`Account deletion failed: ${deletionError.message}`);
        return;
      }

      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) {
        error(`Your account was deleted, but this device could not clear the saved session. Sign in again after refreshing the page.`);
        return;
      }
      window.location.replace('/signin');
    } catch (cause) {
      error(cause instanceof Error ? `Account deletion failed: ${cause.message}` : 'Account deletion failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    const [records, meds, vaccs, appts, documents, reminders, menLogs] = await Promise.all([
      supabase.from('health_records').select('*').eq('user_id', user.id),
      supabase.from('medications').select('*').eq('user_id', user.id),
      supabase.from('vaccinations').select('*').eq('user_id', user.id),
      supabase.from('appointments').select('*').eq('user_id', user.id),
      supabase.from('documents').select('*').eq('user_id', user.id),
      supabase.from('reminders').select('*').eq('user_id', user.id),
      supabase.from('menstrual_logs').select('*').eq('user_id', user.id),
    ]);

    const exportError = records.error || meds.error || vaccs.error || appts.error || documents.error || reminders.error || menLogs.error;
    if (exportError) {
      error(`Failed to export data: ${exportError.message}`);
      return;
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      profile,
      health_records: records.data || [],
      medications: meds.data || [],
      vaccinations: vaccs.data || [],
      appointments: appts.data || [],
      documents: documents.data || [],
      reminders: reminders.data || [],
      menstrual_logs: menLogs.data || [],
      note: 'Document records contain file metadata only; uploaded file contents are not included.',
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `healththread-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    success('Data exported successfully.');
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your profile, privacy, and account.</p>
      </div>

      {/* Profile info */}
      <form onSubmit={handleSave} className="card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-teal-700" />
          <h2 className="section-title">Profile Information</h2>
        </div>

        {formError && <div className="mb-4"><ErrorBanner message={formError} /></div>}

        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="fullName">Full name</label>
            <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="dob">Date of birth</label>
              <input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="input" />
              {dateOfBirth && <p className="text-xs text-slate-400 mt-1">{calculateAge(dateOfBirth)} years old</p>}
            </div>
            <div>
              <label className="label">Biological sex</label>
              <select value={biologicalSex || ''} onChange={(e) => setBiologicalSex(e.target.value)} className="input cursor-pointer">
                <option value="">Not specified</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="intersex">Intersex</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label" htmlFor="bloodType">Blood type</label>
              <select id="bloodType" value={bloodType} onChange={(e) => setBloodType(e.target.value)} className="input cursor-pointer">
                <option value="">Unknown</option>
                {BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="height">Height (cm)</label>
              <input id="height" type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className="input" min="0" />
            </div>
            <div>
              <label className="label" htmlFor="weight">Weight (kg)</label>
              <input id="weight" type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className="input" min="0" />
            </div>
          </div>
        </div>

        {/* Emergency contact */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Emergency contact</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="emName">Contact name</label>
              <input id="emName" type="text" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="emPhone">Contact phone</label>
              <input id="emPhone" type="tel" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} className="input" />
            </div>
          </div>
        </div>

        {/* Menstrual tracking toggle */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-100 text-rose-600 shrink-0">
              <Heart className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Menstrual cycle tracking</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Enable or disable private cycle tracking. Your data is always private and never shared.
              </p>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={menstrualTracking}
                  onChange={(e) => setMenstrualTracking(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-700 focus:ring-teal-500/20"
                />
                <span className="text-sm text-slate-700">Enable cycle tracking</span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Privacy & Data */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-sage-600" />
          <h2 className="section-title">Privacy & Data</h2>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl bg-cream-50 border border-sage-100">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">Export your data</p>
              <p className="text-xs text-slate-500">Download your profile and health data as JSON (file contents excluded)</p>
            </div>
            <button onClick={handleExportData} className="btn-secondary text-sm">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl bg-rose-50 border border-rose-100">
            <div className="min-w-0">
              <p className="text-sm font-medium text-rose-900">Delete account</p>
              <p className="text-xs text-rose-600">Permanently delete all your data</p>
            </div>
            <button onClick={() => setDeleteModalOpen(true)} className="btn-danger text-sm">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Delete account modal */}
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete account" maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">This action is permanent and cannot be undone.</p>
              <p className="text-xs mt-1">Your account, health records, document files, and profile will be permanently deleted. This cannot be undone.</p>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="deletePassword">Current password</label>
            <input
              id="deletePassword"
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="deleteConfirm">Type DELETE to confirm</label>
            <input
              id="deleteConfirm"
              type="text"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              className="input"
              placeholder="DELETE"
              required
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setDeleteModalOpen(false)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={handleDeleteAccount} disabled={deleteConfirm !== 'DELETE' || !deletePassword || saving} className="btn-danger flex-1">
              <Trash2 className="w-4 h-4" /> Delete Account
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
