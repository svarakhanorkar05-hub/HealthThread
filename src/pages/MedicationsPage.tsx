import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Pill,
  Clock,
  Calendar,
  Bell,
  BellRing,
  BellOff,
  CheckCircle2,
  Check,
  AlertCircle,
  X,
  History,
  RotateCcw,
  Smartphone,
  Send,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast, ToastContainer } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { SkeletonList } from '@/components/Skeletons';
import { formatDate, todayDateInputValue, toDateInputValue } from '@/lib/utils';
import {
  checkPushSupport,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  sendLocalTestNotification,
  syncTodayDoses,
  updateDoseStatus,
  type PushStatus,
} from '@/lib/notifications';
import type { Medication, MedicationReminderLog, DoseStatus } from '@/types/database';

export function MedicationsPage() {
  const { user } = useAuth();
  const { toasts, success, error, dismiss } = useToast();
  const [loading, setLoading] = useState(true);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [todayDoses, setTodayDoses] = useState<MedicationReminderLog[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [activeTab, setActiveTab] = useState<'medications' | 'history'>('medications');

  // Push notifications state
  const [pushStatus, setPushStatus] = useState<PushStatus>({
    isSupported: true,
    permission: 'default',
    isSubscribed: false,
    endpoint: null,
  });
  const [enablingPush, setEnablingPush] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  // Modal & form state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [prescriber, setPrescriber] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [reminderTimes, setReminderTimes] = useState<string[]>(['08:00']);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [newTimeInput, setNewTimeInput] = useState('12:00');

  // History state
  const [allHistoryLogs, setAllHistoryLogs] = useState<
    (MedicationReminderLog & { medication_name?: string; dosage?: string })[]
  >([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load medications & today's doses
  const loadMedicationsAndDoses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error: queryError } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false });

      if (queryError) throw queryError;
      const meds = (data || []) as Medication[];
      setMedications(meds);

      // Sync and load today's scheduled doses
      const doses = await syncTodayDoses(user.id, meds);
      setTodayDoses(doses);
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to load medications.');
    } finally {
      setLoading(false);
    }
  }, [user, error]);

  // Check push support on mount
  useEffect(() => {
    checkPushSupport().then(setPushStatus);
  }, []);

  useEffect(() => {
    loadMedicationsAndDoses();
  }, [loadMedicationsAndDoses]);

  // Load history when tab changes
  useEffect(() => {
    if (activeTab === 'history' && user) {
      setLoadingHistory(true);
      supabase
        .from('medication_reminder_logs')
        .select('*, medications(name, dosage)')
        .eq('user_id', user.id)
        .order('scheduled_time', { ascending: false })
        .limit(50)
        .then(({ data, error: histErr }) => {
          if (!histErr && data) {
            const mapped = data.map((d: any) => ({
              ...d,
              medication_name: d.medications?.name || 'Unknown Medicine',
              dosage: d.medications?.dosage || '',
            }));
            setAllHistoryLogs(mapped);
          }
          setLoadingHistory(false);
        });
    }
  }, [activeTab, user]);

  // Handle push subscribe
  const handleEnablePush = async () => {
    if (!user) return;
    setEnablingPush(true);
    try {
      await subscribeToPushNotifications(user.id);
      const updated = await checkPushSupport();
      setPushStatus(updated);
      success('Background push reminders enabled for this device!');
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Could not enable push notifications');
    } finally {
      setEnablingPush(false);
    }
  };

  // Handle push unsubscribe
  const handleDisablePush = async () => {
    if (!user) return;
    try {
      await unsubscribeFromPushNotifications(user.id);
      const updated = await checkPushSupport();
      setPushStatus(updated);
      success('Reminders disabled for this device.');
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to disable notifications');
    }
  };

  // Test notification
  const handleTestNotification = async () => {
    setSendingTest(true);
    try {
      const firstMed = medications.find((m) => m.active);
      await sendLocalTestNotification(
        firstMed?.name || 'Paracetamol',
        firstMed?.dosage || '500 mg'
      );
      success('Test reminder sent! Check your system notification banner.');
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to send test reminder');
    } finally {
      setSendingTest(false);
    }
  };

  // Handle Dose Actions (Taken / Snooze / Skip)
  const handleDoseAction = async (doseId: string, status: DoseStatus) => {
    try {
      const updated = await updateDoseStatus(doseId, status);
      setTodayDoses((prev) => prev.map((d) => (d.id === doseId ? updated : d)));
      if (status === 'taken') success('Dose recorded as Taken. Great job!');
      else if (status === 'snoozed') success('Dose snoozed for 15 minutes.');
      else if (status === 'skipped') success('Dose marked as Skipped.');
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to record dose status');
    }
  };

  const filteredMeds = showInactive ? medications : medications.filter((m) => m.active);

  const openCreateModal = () => {
    setEditingMed(null);
    setName('');
    setDosage('');
    setFrequency('');
    setStartDate(todayDateInputValue());
    setEndDate('');
    setPrescriber('');
    setNotes('');
    setActive(true);
    setReminderTimes(['08:00']);
    setRemindersEnabled(true);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (med: Medication) => {
    setEditingMed(med);
    setName(med.name);
    setDosage(med.dosage);
    setFrequency(med.frequency || '');
    setStartDate(toDateInputValue(med.start_date));
    setEndDate(toDateInputValue(med.end_date));
    setPrescriber(med.prescriber || '');
    setNotes(med.notes || '');
    setActive(med.active);
    setReminderTimes(med.reminder_times && med.reminder_times.length > 0 ? med.reminder_times : ['08:00']);
    setRemindersEnabled(med.reminders_enabled !== false);
    setFormError(null);
    setModalOpen(true);
  };

  const addReminderTime = () => {
    if (!newTimeInput) return;
    if (!reminderTimes.includes(newTimeInput)) {
      setReminderTimes((prev) => [...prev, newTimeInput].sort());
    }
  };

  const removeReminderTime = (timeToRemove: string) => {
    setReminderTimes((prev) => prev.filter((t) => t !== timeToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setFormError(null);

    if (!name.trim() || !dosage.trim()) {
      setFormError('Medication name and dosage are required.');
      setSaving(false);
      return;
    }
    if (endDate && endDate < startDate) {
      setFormError('End date cannot be earlier than the start date.');
      setSaving(false);
      return;
    }

    const payload = {
      name: name.trim(),
      dosage: dosage.trim(),
      frequency: frequency.trim() || null,
      start_date: startDate,
      end_date: endDate || null,
      prescriber: prescriber.trim() || null,
      notes: notes.trim() || null,
      active,
      reminder_times: reminderTimes,
      reminders_enabled: remindersEnabled,
    };

    if (editingMed) {
      const { error: updateError } = await supabase
        .from('medications')
        .update(payload)
        .eq('id', editingMed.id)
        .eq('user_id', user.id);

      if (updateError) {
        setFormError(updateError.message);
        setSaving(false);
        return;
      }
      success('Medication schedule updated.');
    } else {
      const { error: insertError } = await supabase
        .from('medications')
        .insert({ ...payload, user_id: user.id });

      if (insertError) {
        setFormError(insertError.message);
        setSaving(false);
        return;
      }
      success('Medication added with reminders.');
    }

    setModalOpen(false);
    setSaving(false);
    loadMedicationsAndDoses();
  };

  const handleDelete = async () => {
    if (!deleteId || !user) return;
    const { error: deleteError } = await supabase
      .from('medications')
      .delete()
      .eq('id', deleteId)
      .eq('user_id', user.id);

    if (deleteError) {
      error('Failed to delete medication.');
    } else {
      success('Medication deleted.');
      loadMedicationsAndDoses();
    }
    setDeleteId(null);
  };

  const toggleActive = async (med: Medication) => {
    if (!user) return;
    const { error: updateError } = await supabase
      .from('medications')
      .update({ active: !med.active })
      .eq('id', med.id)
      .eq('user_id', user.id);

    if (updateError) {
      error('Failed to update.');
    } else {
      loadMedicationsAndDoses();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Medications &amp; Reminders
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your prescriptions, schedule doses, and receive automatic background reminders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openCreateModal} className="btn-primary text-sm shadow-sm">
            <Plus className="w-4 h-4" /> Add Medication
          </button>
        </div>
      </div>

      {/* Push Notification Setup & Status Card */}
      <div className="card p-4 sm:p-5 border border-teal-100 bg-gradient-to-br from-white to-teal-50/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                pushStatus.isSubscribed
                  ? 'bg-sage-100 text-sage-700'
                  : 'bg-teal-100 text-teal-700'
              }`}
            >
              {pushStatus.isSubscribed ? (
                <BellRing className="w-5 h-5 text-sage-700" />
              ) : (
                <Bell className="w-5 h-5 text-teal-700" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-slate-900">
                  Background Push Reminders
                </h3>
                {pushStatus.isSubscribed ? (
                  <span className="badge bg-sage-50 text-sage-700 border border-sage-200">
                    <Check className="w-3 h-3 text-sage-600" /> Active on this device
                  </span>
                ) : (
                  <span className="badge bg-amber-50 text-amber-700 border border-amber-200">
                    Not Enabled
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Receive scheduled alerts on Windows laptops, Android phones, and iPads even when HealthThread is closed.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
            {pushStatus.isSubscribed ? (
              <>
                <button
                  type="button"
                  onClick={handleTestNotification}
                  disabled={sendingTest}
                  className="btn btn-secondary text-xs px-3 py-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sendingTest ? 'Sending...' : 'Test Reminder'}
                </button>
                <button
                  type="button"
                  onClick={handleDisablePush}
                  className="btn btn-ghost text-xs text-slate-400 hover:text-rose-600 px-3 py-2"
                >
                  Disable
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={enablingPush}
                className="btn btn-primary text-xs px-4 py-2"
              >
                {enablingPush ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Enabling...
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5" />
                    Enable Push Reminders
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TODAY'S SCHEDULE & DOSE TRACKER BANNER */}
      {todayDoses.length > 0 && (
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-700" /> Today's Medication Schedule
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              {todayDoses.filter((d) => d.status === 'taken').length} of {todayDoses.length} doses taken
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {todayDoses.map((dose) => {
              const med = medications.find((m) => m.id === dose.medication_id);
              if (!med) return null;

              return (
                <div
                  key={dose.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    dose.status === 'taken'
                      ? 'bg-sage-50/50 border-sage-200'
                      : dose.status === 'snoozed'
                      ? 'bg-amber-50/50 border-amber-200'
                      : dose.status === 'skipped'
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : 'bg-white border-slate-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                        {dose.dose_time}
                      </span>
                      <h4 className="font-semibold text-sm text-slate-900 mt-1">{med.name}</h4>
                      <p className="text-xs text-slate-500">{med.dosage}</p>
                    </div>

                    <span
                      className={`badge text-[10px] ${
                        dose.status === 'taken'
                          ? 'bg-sage-100 text-sage-800 border-sage-200'
                          : dose.status === 'snoozed'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : dose.status === 'skipped'
                          ? 'bg-slate-200 text-slate-700 border-slate-300'
                          : 'bg-teal-50 text-teal-800 border-teal-200'
                      }`}
                    >
                      {dose.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Quick Action buttons */}
                  {dose.status === 'pending' || dose.status === 'snoozed' ? (
                    <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleDoseAction(dose.id, 'taken')}
                        className="btn btn-primary text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Taken
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDoseAction(dose.id, 'snoozed')}
                        className="btn btn-secondary text-xs py-1.5 px-2.5"
                        title="Snooze 15 minutes"
                      >
                        Snooze
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDoseAction(dose.id, 'skipped')}
                        className="btn btn-ghost text-xs py-1.5 px-2 text-slate-400"
                        title="Skip dose"
                      >
                        Skip
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Status recorded</span>
                      <button
                        onClick={() => handleDoseAction(dose.id, 'pending')}
                        className="text-teal-700 hover:underline flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs: Active Medications vs Reminder History */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('medications')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'medications'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            My Medications ({filteredMeds.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Dose History
          </button>
        </div>

        {activeTab === 'medications' && (
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setShowInactive(false)}
              className={`px-2.5 py-1 rounded-md transition-all ${
                !showInactive ? 'bg-slate-200 font-semibold text-slate-800' : 'text-slate-500'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setShowInactive(true)}
              className={`px-2.5 py-1 rounded-md transition-all ${
                showInactive ? 'bg-slate-200 font-semibold text-slate-800' : 'text-slate-500'
              }`}
            >
              All
            </button>
          </div>
        )}
      </div>

      {/* TAB CONTENT 1: MEDICATIONS LIST */}
      {activeTab === 'medications' && (
        <>
          {loading ? (
            <SkeletonList count={4} />
          ) : filteredMeds.length === 0 ? (
            <div className="card p-8">
              <EmptyState
                icon={<Pill className="w-7 h-7" />}
                title="No medications recorded"
                description="Add your current medications to keep track of dosages, schedules, and automatic reminders."
                action={
                  <button onClick={openCreateModal} className="btn-primary text-sm">
                    <Plus className="w-4 h-4" /> Add Medication
                  </button>
                }
              />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {filteredMeds.map((med) => (
                <div key={med.id} className="card card-hover p-4 group flex flex-col justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
                        med.active ? 'bg-sage-50 text-sage-700' : 'bg-slate-50 text-slate-400'
                      }`}
                    >
                      <Pill className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-slate-900 break-words">
                          {med.name}
                        </h3>
                        {med.active ? (
                          <span className="badge bg-sage-50 text-sage-700 border border-sage-100">
                            Active
                          </span>
                        ) : (
                          <span className="badge bg-slate-50 text-slate-500 border border-slate-100">
                            Inactive
                          </span>
                        )}
                        {med.reminders_enabled !== false && (
                          <span className="badge bg-teal-50 text-teal-700 border border-teal-100">
                            Reminders ON
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5 break-words font-medium">
                        {med.dosage}
                      </p>
                      {med.frequency && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" /> {med.frequency}
                        </p>
                      )}

                      {/* Reminder Times Chips */}
                      {med.reminder_times && med.reminder_times.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-2">
                          <span className="text-[11px] text-slate-400 font-medium mr-1">
                            Reminders:
                          </span>
                          {med.reminder_times.map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded-md bg-cream-100 text-teal-800 border border-sage-100 text-[11px] font-semibold"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      {med.notes && (
                        <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {med.notes}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatDate(med.start_date)}
                        </span>
                        {med.end_date && <span>to {formatDate(med.end_date)}</span>}
                      </div>
                      {med.prescriber && (
                        <p className="text-xs text-slate-500 mt-1">Prescribed by {med.prescriber}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                      <button
                        aria-label={`Edit ${med.name}`}
                        onClick={() => openEditModal(med)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleActive(med)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 text-xs"
                      >
                        {med.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        aria-label={`Delete ${med.name}`}
                        onClick={() => setDeleteId(med.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB CONTENT 2: DOSE HISTORY */}
      {activeTab === 'history' && (
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title text-base flex items-center gap-2">
              <History className="w-4 h-4 text-teal-700" /> Medication Adherence History
            </h3>
            <span className="text-xs text-slate-400">Past doses &amp; actions</span>
          </div>

          {loadingHistory ? (
            <SkeletonList count={4} />
          ) : allHistoryLogs.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              No dose history recorded yet. As you mark scheduled doses, your adherence history will be tracked here.
            </p>
          ) : (
            <div className="space-y-2">
              {allHistoryLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl border border-slate-100 hover:bg-cream-50/50 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        log.status === 'taken'
                          ? 'bg-sage-50 text-sage-700'
                          : log.status === 'snoozed'
                          ? 'bg-amber-50 text-amber-700'
                          : log.status === 'skipped'
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-teal-50 text-teal-700'
                      }`}
                    >
                      {log.status === 'taken' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {log.medication_name} ({log.dosage})
                      </p>
                      <p className="text-xs text-slate-400">
                        Scheduled for: {new Date(log.scheduled_time).toLocaleString()}
                        {log.action_time && ` · Action: ${new Date(log.action_time).toLocaleTimeString()}`}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`badge text-xs uppercase font-medium ${
                      log.status === 'taken'
                        ? 'bg-sage-100 text-sage-800'
                        : log.status === 'snoozed'
                        ? 'bg-amber-100 text-amber-800'
                        : log.status === 'skipped'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-teal-100 text-teal-800'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Medication Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingMed ? 'Edit Medication' : 'Add Medication'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <ErrorBanner message={formError} />}

          <div>
            <label className="label" htmlFor="medName">
              Medication name *
            </label>
            <input
              id="medName"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="e.g., Paracetamol"
            />
          </div>

          <div>
            <label className="label" htmlFor="medDosage">
              Dosage *
            </label>
            <input
              id="medDosage"
              type="text"
              required
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              className="input"
              placeholder="e.g., 500 mg"
            />
          </div>

          <div>
            <label className="label" htmlFor="medFrequency">
              Frequency
            </label>
            <input
              id="medFrequency"
              type="text"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="input"
              placeholder="e.g., 3 times daily with meals"
            />
          </div>

          {/* Daily Reminder Times Picker */}
          <div className="p-3.5 rounded-xl bg-teal-50/50 border border-teal-100 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-teal-900 uppercase tracking-wider">
                Daily Reminder Times
              </label>
              <label className="flex items-center gap-1.5 text-xs text-teal-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remindersEnabled}
                  onChange={(e) => setRemindersEnabled(e.target.checked)}
                  className="rounded text-teal-700"
                />
                Enable Reminders
              </label>
            </div>

            {remindersEnabled && (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  {reminderTimes.map((time) => (
                    <span
                      key={time}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-teal-200 text-teal-900 text-xs font-bold shadow-sm"
                    >
                      <Clock className="w-3 h-3 text-teal-600" />
                      {time}
                      <button
                        type="button"
                        onClick={() => removeReminderTime(time)}
                        className="text-slate-400 hover:text-rose-600 ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="time"
                    value={newTimeInput}
                    onChange={(e) => setNewTimeInput(e.target.value)}
                    className="input py-1.5 text-xs w-36"
                  />
                  <button
                    type="button"
                    onClick={addReminderTime}
                    className="btn btn-secondary py-1.5 px-3 text-xs"
                  >
                    + Add Time
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="medStart">
                Start date *
              </label>
              <input
                id="medStart"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="medEnd">
                End date (optional)
              </label>
              <input
                id="medEnd"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="medPrescriber">
              Prescribed by
            </label>
            <input
              id="medPrescriber"
              type="text"
              value={prescriber}
              onChange={(e) => setPrescriber(e.target.value)}
              className="input"
              placeholder="e.g., Dr. Smith"
            />
          </div>

          <div>
            <label className="label" htmlFor="medNotes">
              Instructions
            </label>
            <textarea
              id="medNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input min-h-[60px] resize-y"
              placeholder="How and when to take this medication..."
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 rounded text-teal-700 focus:ring-teal-500/20"
            />
            <span className="text-sm text-slate-700">Active medication</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving ? 'Saving...' : editingMed ? 'Update' : 'Add Medication'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete medication?"
        maxWidth="max-w-sm"
      >
        <p className="text-sm text-slate-600 mb-4">
          This will permanently delete this medication record and its scheduled reminders.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteId(null)} className="btn-ghost flex-1">
            Cancel
          </button>
          <button onClick={handleDelete} className="btn-danger flex-1">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
