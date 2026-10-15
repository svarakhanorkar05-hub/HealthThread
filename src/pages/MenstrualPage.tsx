import { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Edit2, Trash2, HeartPulse, ChevronLeft, ChevronRight, Info, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast, ToastContainer } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { SkeletonList } from '@/components/Skeletons';
import { formatDate, toDateInputValue } from '@/lib/utils';
import {
  analyzeCycleHistory,
  dateOnlyToLocalDate,
  getAgeFromDateOfBirth,
  getCycleEducation,
  localDateToDateOnly,
  validatePeriodDates,
} from '@/lib/menstrual';
import type { MenstrualLog } from '@/types/database';

const FLOW_COLORS: Record<string, string> = {
  light: 'bg-rose-100 text-rose-700',
  moderate: 'bg-rose-200 text-rose-800',
  heavy: 'bg-rose-300 text-rose-900',
};

const CRAMP_COLORS: Record<string, string> = {
  none: 'bg-sage-50 text-sage-700',
  mild: 'bg-amber-50 text-amber-700',
  moderate: 'bg-orange-100 text-orange-700',
  severe: 'bg-rose-100 text-rose-700',
};

const SYMPTOM_OPTIONS = [
  'Headache', 'Bloating', 'Breast tenderness', 'Acne', 'Fatigue',
  'Backache', 'Nausea', 'Food cravings', 'Mood swings', 'Insomnia',
  'Dizziness', 'Diarrhea', 'Constipation', 'Tender muscles',
];

export function MenstrualPage() {
  const { user, profile } = useAuth();
  const { toasts, success, error, dismiss } = useToast();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<MenstrualLog[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<MenstrualLog | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [flowLevel, setFlowLevel] = useState('');
  const [cramps, setCramps] = useState('');
  const [painLevel, setPainLevel] = useState('');
  const [mood, setMood] = useState('');
  const [energy, setEnergy] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const today = localDateToDateOnly(new Date());
  const age = getAgeFromDateOfBirth(profile?.date_of_birth ?? null);

  const loadLogs = useCallback(async () => {
    if (!user || !profile?.menstrual_tracking_enabled) {
      setLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error: queryError } = await supabase
        .from('menstrual_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('period_start', { ascending: false });

      if (queryError) {
        error(`Failed to load cycle data: ${queryError.message}`);
      } else {
        setLogs((data ?? []) as MenstrualLog[]);
      }
    } catch (cause) {
      error(cause instanceof Error ? cause.message : 'Failed to load cycle data.');
    } finally {
      setLoading(false);
    }
  }, [user, profile?.menstrual_tracking_enabled, error]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Cycle calculations
  const cycleInfo = useMemo(
    () => analyzeCycleHistory(logs, today, age),
    [logs, today, age],
  );
  const education = getCycleEducation(age);

  // Calendar days
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(new Date(year, month, d));
    return days;
  }, [calendarMonth]);

  const periodDateRanges = useMemo(() => {
    return logs.flatMap((log) => {
      const start = dateOnlyToLocalDate(log.period_start);
      const end = log.period_end ? dateOnlyToLocalDate(log.period_end) : start;
      return start && end && end >= start ? [{ start, end, log }] : [];
    });
  }, [logs]);

  const isDateInPeriod = (date: Date): MenstrualLog | null => {
    for (const range of periodDateRanges) {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const s = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
      const e = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate());
      if (d >= s && d <= e) return range.log;
    }
    return null;
  };

  const isPredictedStart = (date: Date): boolean => {
    if (!cycleInfo.predictionStart || !cycleInfo.predictionEnd || localDateToDateOnly(date) < today) return false;
    const dateOnly = localDateToDateOnly(date);
    return dateOnly >= cycleInfo.predictionStart && dateOnly <= cycleInfo.predictionEnd;
  };

  const openCreateModal = (startDate = today) => {
    setEditingLog(null);
    setPeriodStart(startDate);
    setPeriodEnd('');
    setFlowLevel('');
    setCramps('');
    setPainLevel('');
    setMood('');
    setEnergy('');
    setSleepHours('');
    setSymptoms([]);
    setNotes('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (log: MenstrualLog) => {
    setEditingLog(log);
    setPeriodStart(toDateInputValue(log.period_start));
    setPeriodEnd(toDateInputValue(log.period_end));
    setFlowLevel(log.flow_level || '');
    setCramps(log.cramps || '');
    setPainLevel(log.pain_level?.toString() || '');
    setMood(log.mood || '');
    setEnergy(log.energy || '');
    setSleepHours(log.sleep_hours?.toString() || '');
    setSymptoms(log.symptoms || []);
    setNotes(log.notes || '');
    setFormError(null);
    setModalOpen(true);
  };

  const toggleSymptom = (symptom: string) => {
    setSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.menstrual_tracking_enabled) return;
    setSaving(true);
    setFormError(null);

    const dateError = validatePeriodDates(periodStart, periodEnd, logs, today, editingLog?.id);
    if (dateError) {
      setFormError(dateError);
      setSaving(false);
      return;
    }

    const parsedPain = painLevel === '' ? null : Number(painLevel);
    const parsedSleep = sleepHours === '' ? null : Number(sleepHours);
    if (parsedPain !== null && (!Number.isInteger(parsedPain) || parsedPain < 0 || parsedPain > 10)) {
      setFormError('Pain level must be a whole number from 0 to 10.');
      setSaving(false);
      return;
    }
    if (parsedSleep !== null && (!Number.isFinite(parsedSleep) || parsedSleep < 0 || parsedSleep > 24)) {
      setFormError('Sleep hours must be between 0 and 24.');
      setSaving(false);
      return;
    }

    const payload = {
      period_start: periodStart,
      period_end: periodEnd || null,
      flow_level: flowLevel || null,
      cramps: cramps || null,
      pain_level: parsedPain,
      mood: mood.trim() || null,
      energy: energy || null,
      sleep_hours: parsedSleep,
      symptoms: symptoms.length > 0 ? symptoms : null,
      notes: notes.trim() || null,
    };

    try {
      if (editingLog) {
        const { error: updateError } = await supabase
          .from('menstrual_logs')
          .update(payload)
          .eq('id', editingLog.id)
          .eq('user_id', user.id);

        if (updateError) {
          setFormError(updateError.message);
          return;
        }
        success('Cycle log updated.');
      } else {
        const { error: insertError } = await supabase
          .from('menstrual_logs')
          .insert({ ...payload, user_id: user.id });

        if (insertError) {
          setFormError(insertError.message);
          return;
        }
        success('Period logged successfully.');
      }

      setModalOpen(false);
      await loadLogs();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Failed to save cycle log.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId || !user || !profile?.menstrual_tracking_enabled) return;
    try {
      const { error: deleteError } = await supabase
        .from('menstrual_logs')
        .delete()
        .eq('id', deleteId)
        .eq('user_id', user.id);

      if (deleteError) {
        error(`Failed to delete log: ${deleteError.message}`);
      } else {
        success('Cycle log deleted.');
        await loadLogs();
      }
    } catch (cause) {
      error(cause instanceof Error ? cause.message : 'Failed to delete cycle log.');
    } finally {
      setDeleteId(null);
    }
  };

  if (!profile?.menstrual_tracking_enabled) {
    return (
      <div className="animate-fade-in">
        <div className="card p-8">
          <EmptyState
            icon={<HeartPulse className="w-7 h-7" />}
            title="Cycle tracking is not enabled"
            description="Enable menstrual tracking in Settings to start logging your cycles. Your data is private and only visible to you."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cycle Tracking</h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> Private — only you can see this data.
          </p>
        </div>
        <button onClick={() => openCreateModal()} className="btn-primary">
          <Plus className="w-4 h-4" /> Log Period
        </button>
      </div>

      {/* Cycle summary cards */}
      {!loading && cycleInfo.totalCycles > 0 && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <SummaryCard label="Avg Cycle" value={cycleInfo.avgCycleLength ? `${cycleInfo.avgCycleLength} days` : '—'} sub={cycleInfo.avgCycleLength ? 'Based on recorded history' : 'Need more data'} />
          <SummaryCard label="Avg Period" value={cycleInfo.avgPeriodLength ? `${cycleInfo.avgPeriodLength} days` : '—'} sub={cycleInfo.avgPeriodLength ? 'Average duration' : 'Add end dates'} />
          <SummaryCard label="Cycles Logged" value={String(cycleInfo.totalCycles)} sub="Total records" />
          <SummaryCard
            label="Estimated window"
            value={
              cycleInfo.predictionStart && cycleInfo.predictionEnd
                ? cycleInfo.predictionStart === cycleInfo.predictionEnd
                  ? formatDate(cycleInfo.predictionStart)
                  : `${formatDate(cycleInfo.predictionStart)} – ${formatDate(cycleInfo.predictionEnd)}`
                : 'Not available'
            }
            sub={
              cycleInfo.predictionReliability === 'more-reliable'
                ? `Estimate from ${cycleInfo.predictionIntervals} recent intervals`
                : cycleInfo.predictionReliability === 'limited'
                  ? `Limited estimate · ${cycleInfo.predictionIntervals} intervals`
                  : 'Need 2 suitable intervals'
            }
            highlight={!!cycleInfo.predictionStart}
          />
        </div>
      )}

      {/* Irregularity notice */}
      {!loading && cycleInfo.irregular && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-sm flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Your recent cycle lengths vary or fall outside the usual range.</p>
            <p className="text-xs mt-0.5">Variation can happen for many reasons. The calendar shows a wider estimate when there is enough history; it withholds estimates when recent intervals are outside the supported range. Consider talking with a healthcare professional if you are concerned.</p>
          </div>
        </div>
      )}

      {!loading && cycleInfo.hasLongPeriod && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-sm flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <p>One or more logged periods lasted longer than 7 days. This is a record-based reminder, not a diagnosis; consider asking a healthcare professional if you are concerned.</p>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Estimates use the median of up to 6 recent start-to-start intervals. For steady intervals, the window is ±2 days; when intervals vary by more than 7 days, it spans the observed range. At least 2 suitable intervals are needed. It does not predict ovulation or pregnancy and is not birth control.
      </p>

      <div className="grid xl:grid-cols-3 gap-4">
        {/* Calendar */}
        <div className="card p-3 sm:p-5 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="section-title flex min-w-0 items-center gap-2">
              <CalendarIcon className="w-4.5 h-4.5 text-rose-500" />
              {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex shrink-0 gap-1">
              <button
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCalendarMonth(new Date())}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                Today
              </button>
              <button
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarDays.map((date, i) => {
              if (!date) return <div key={i} />;
              const periodLog = isDateInPeriod(date);
              const isPredicted = isPredictedStart(date);
              const isToday = date.toDateString() === new Date().toDateString();
              const dateText = localDateToDateOnly(date);
              const dayLabel = periodLog
                ? `${date.toLocaleDateString('en-US', { dateStyle: 'full' })}, period logged`
                : isPredicted
                  ? `${date.toLocaleDateString('en-US', { dateStyle: 'full' })}, estimated period window`
                  : date.toLocaleDateString('en-US', { dateStyle: 'full' });

              return (
                <button
                  key={i}
                  type="button"
                  aria-label={dayLabel}
                  title={dayLabel}
                  onClick={() => openCreateModal(dateText)}
                  disabled={dateText > today}
                  className={`aspect-square flex items-center justify-center rounded-lg text-sm relative transition-all ${
                    periodLog
                      ? FLOW_COLORS[periodLog.flow_level || 'moderate'] || 'bg-rose-200 text-rose-800 font-medium'
                      : isPredicted
                      ? 'bg-rose-50 text-rose-400 border border-dashed border-rose-200'
                      : isToday
                      ? 'bg-teal-50 text-teal-700 font-medium ring-1 ring-teal-200'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {date.getDate()}
                  {periodLog && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-rose-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-rose-200" /> Period
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border border-dashed border-rose-200 bg-rose-50" /> Predicted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded ring-1 ring-teal-200 bg-teal-50" /> Today
            </span>
          </div>
        </div>

        {/* Cycle history */}
        <div className="card p-5">
          <h2 className="section-title flex items-center gap-2 text-base mb-3">
            <TrendingUp className="w-4 h-4 text-rose-500" /> Cycle History
          </h2>
          {loading ? (
            <SkeletonList count={3} />
          ) : logs.length === 0 ? (
            <EmptyState
              icon={<HeartPulse className="w-7 h-7" />}
              title="No logs yet"
              description="Log your period to start tracking your cycle."
              action={
                <button onClick={() => openCreateModal()} className="btn-primary text-sm">
                  <Plus className="w-4 h-4" /> Log Period
                </button>
              }
            />
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
              {logs.map((log) => (
                <div key={log.id} className="p-3 rounded-xl bg-cream-50 border border-sage-100 group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {formatDate(log.period_start)}
                      </p>
                      {log.period_end && (
                        <p className="text-xs text-slate-500">to {formatDate(log.period_end)}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {log.flow_level && (
                          <span className={`badge ${FLOW_COLORS[log.flow_level]}`}>{log.flow_level}</span>
                        )}
                        {log.cramps && (
                          <span className={`badge ${CRAMP_COLORS[log.cramps]}`}>Cramps: {log.cramps}</span>
                        )}
                        {log.pain_level !== null && (
                          <span className="badge bg-slate-50 text-slate-600">Pain: {log.pain_level}/10</span>
                        )}
                        {log.energy && (
                          <span className="badge bg-slate-50 text-slate-600">Energy: {log.energy}</span>
                        )}
                        {log.sleep_hours !== null && (
                          <span className="badge bg-slate-50 text-slate-600">Sleep: {log.sleep_hours}h</span>
                        )}
                      </div>
                      {log.symptoms?.length ? (
                        <p className="text-xs text-slate-600 mt-1.5">Symptoms: {log.symptoms.join(', ')}</p>
                      ) : null}
                      {log.mood && <p className="text-xs text-slate-500 mt-1">Mood: {log.mood}</p>}
                      {log.notes && <p className="text-xs text-slate-500 mt-1">{log.notes}</p>}
                    </div>
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          aria-label={`Edit period starting ${formatDate(log.period_start)}`}
                          onClick={() => openEditModal(log)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete period starting ${formatDate(log.period_start)}`}
                        onClick={() => setDeleteId(log.id)}
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
        </div>
      </div>

      {/* Educational content */}
      <div className="card p-5 bg-gradient-to-br from-rose-50/50 to-cream-50">
        <h2 className="section-title flex items-center gap-2 text-base mb-3">
          <Info className="w-4 h-4 text-teal-700" /> Understanding Your Cycle
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm text-slate-600">
          <div>
            <h3 className="font-medium text-slate-900 mb-1">{education.heading}</h3>
            <p>{education.summary}</p>
          </div>
          <div>
            <h3 className="font-medium text-slate-900 mb-1">Getting support</h3>
            <p>{education.guidance}</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
          This private tracker is optional and provides education only. It does not diagnose conditions, determine pregnancy, predict ovulation, provide contraception, or replace professional care.
        </p>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingLog ? 'Edit Period Log' : 'Log Period'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <ErrorBanner message={formError} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="periodStart">Period start *</label>
              <input
                id="periodStart"
                type="date"
                required
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                max={today}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="periodEnd">Period end (optional)</label>
              <input
                id="periodEnd"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                min={periodStart || undefined}
                max={today}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Flow level</label>
            <div className="flex gap-2">
              {['light', 'moderate', 'heavy'].map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={flowLevel === f}
                  onClick={() => setFlowLevel(flowLevel === f ? '' : f)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-all ${
                    flowLevel === f
                      ? FLOW_COLORS[f] + ' ring-2 ring-rose-300/40'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-rose-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Cramps</label>
            <div className="flex gap-2">
              {['none', 'mild', 'moderate', 'severe'].map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={cramps === c}
                  onClick={() => setCramps(cramps === c ? '' : c)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-all ${
                    cramps === c
                      ? CRAMP_COLORS[c] + ' ring-2 ring-amber-300/40'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-amber-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="painLevel">Pain level (0-10)</label>
              <input
                id="painLevel"
                type="number"
                min="0"
                max="10"
                step="1"
                value={painLevel}
                onChange={(e) => setPainLevel(e.target.value)}
                className="input"
                placeholder="0"
              />
            </div>
            <div>
              <label className="label" htmlFor="sleepHours">Sleep (hours)</label>
              <input
                id="sleepHours"
                type="number"
                min="0"
                max="24"
                step="0.1"
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                className="input"
                placeholder="7.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="mood">Mood</label>
              <input
                id="mood"
                type="text"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="input"
                placeholder="e.g., calm, irritable"
              />
            </div>
            <div>
              <label className="label">Energy</label>
              <select
                value={energy}
                onChange={(e) => setEnergy(e.target.value)}
                className="input cursor-pointer"
              >
                <option value="">Select</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Symptoms</label>
            <div className="flex flex-wrap gap-2">
              {SYMPTOM_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={symptoms.includes(s)}
                  onClick={() => toggleSymptom(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    symptoms.includes(s)
                      ? 'bg-teal-700 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-teal-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input min-h-[60px] resize-y"
              placeholder="Any additional notes..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : editingLog ? 'Update' : 'Log Period'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete period log?"
        maxWidth="max-w-sm"
      >
        <p className="text-sm text-slate-600 mb-4">
          This will permanently delete this cycle log. This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteId(null)} className="btn-ghost flex-1">Cancel</button>
          <button onClick={handleDelete} className="btn-danger flex-1">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className={`card min-w-0 p-4 ${highlight ? 'border-rose-100 bg-rose-50/30' : ''}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900 mt-1 break-words">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5 break-words">{sub}</p>
    </div>
  );
}
