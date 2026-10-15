import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Pill,
  Syringe,
  AlertCircle,
  FileText,
  HeartPulse,
  Plus,
  Activity,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast, ToastContainer } from '@/components/Toast';
import { SkeletonCard } from '@/components/Skeletons';
import { EmptyState } from '@/components/EmptyState';
import { formatDate, relativeTime, daysUntil } from '@/lib/utils';
import { RECORD_TYPE_LABELS, RECORD_TYPE_ICONS, RECORD_TYPE_COLORS, normalizeHealthRecordType } from '@/lib/constants';
import type { HealthRecord, Medication, Vaccination, Appointment, MenstrualLog } from '@/types/database';

export function DashboardPage() {
  const { user, profile } = useAuth();
  const { toasts, error, dismiss } = useToast();
  const [loading, setLoading] = useState(true);
  const [recentRecords, setRecentRecords] = useState<HealthRecord[]>([]);
  const [activeMedications, setActiveMedications] = useState<Medication[]>([]);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [allergies, setAllergies] = useState<HealthRecord[]>([]);
  const [conditions, setConditions] = useState<HealthRecord[]>([]);
  const [menstrualLogs, setMenstrualLogs] = useState<MenstrualLog[]>([]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [recordsRes, medsRes, vaccRes, apptsRes, allergyRes, condRes, menRes] = await Promise.all([
      supabase.from('health_records').select('*').eq('user_id', user.id).order('event_date', { ascending: false }).limit(5),
      supabase.from('medications').select('*').eq('user_id', user.id).eq('active', true).order('start_date', { ascending: false }),
      supabase.from('vaccinations').select('*').eq('user_id', user.id).order('date_administered', { ascending: false }).limit(5),
      supabase.from('appointments').select('*').eq('user_id', user.id).eq('status', 'upcoming').order('appointment_date', { ascending: true }).limit(3),
      supabase.from('health_records').select('*').eq('user_id', user.id).eq('record_type', 'allergy').order('event_date', { ascending: false }),
      supabase.from('health_records').select('*').eq('user_id', user.id).eq('record_type', 'condition').order('event_date', { ascending: false }),
      profile?.menstrual_tracking_enabled
        ? supabase.from('menstrual_logs').select('*').eq('user_id', user.id).order('period_start', { ascending: false }).limit(3)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (recordsRes.data) setRecentRecords(recordsRes.data as HealthRecord[]);
    if (medsRes.data) setActiveMedications(medsRes.data as Medication[]);
    if (vaccRes.data) setVaccinations(vaccRes.data as Vaccination[]);
    if (apptsRes.data) setUpcomingAppointments(apptsRes.data as Appointment[]);
    if (allergyRes.data) setAllergies(allergyRes.data as HealthRecord[]);
    if (condRes.data) setConditions(condRes.data as HealthRecord[]);
    if (menRes.data) setMenstrualLogs(menRes.data as MenstrualLog[]);

    if (
      recordsRes.error
      || medsRes.error
      || vaccRes.error
      || apptsRes.error
      || allergyRes.error
      || condRes.error
      || menRes.error
    ) {
      error('Failed to load some health data. Refresh the page to try again.');
    }
    setLoading(false);
  }, [user, profile, error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const nextVaccination = vaccinations.find((v) => v.next_due_date && daysUntil(v.next_due_date) > 0);
  const latestPeriod = menstrualLogs[0];
  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Here's your health overview for today, {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/records" className="btn-secondary text-sm">
            <FileText className="w-4 h-4" /> Add Record
          </Link>
          <Link to="/appointments" className="btn-secondary text-sm">
            <Calendar className="w-4 h-4" /> Add Appointment
          </Link>
          {profile?.menstrual_tracking_enabled && (
            <Link to="/menstrual" className="btn-secondary text-sm">
              <HeartPulse className="w-4 h-4" /> Log Period
            </Link>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="Health Records"
          value={loading ? null : String(recentRecords.length > 0 ? recentRecords.length : 0)}
          color="teal"
          link="/records"
        />
        <StatCard
          icon={<Pill className="w-5 h-5" />}
          label="Active Medications"
          value={loading ? null : String(activeMedications.length)}
          color="sage"
          link="/medications"
        />
        <StatCard
          icon={<Syringe className="w-5 h-5" />}
          label="Vaccines Recorded"
          value={loading ? null : String(vaccinations.length)}
          color="teal"
          link="/vaccinations"
        />
        <StatCard
          icon={<Calendar className="w-5 h-5" />}
          label="Upcoming Appts"
          value={loading ? null : String(upcomingAppointments.length)}
          color="sage"
          link="/appointments"
        />
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Health Timeline */}
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-teal-700" /> Recent Health Events
              </h2>
              <Link to="/records" className="text-sm text-teal-700 font-medium hover:text-teal-800">
                View all
              </Link>
            </div>
            {recentRecords.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-7 h-7" />}
                title="No health records yet"
                description="Start tracking your health by adding your first record."
                action={
                  <Link to="/records" className="btn-primary text-sm">
                    <Plus className="w-4 h-4" /> Add Record
                  </Link>
                }
              />
            ) : (
              <div className="space-y-1">
                {recentRecords.map((record) => {
                  const recordType = normalizeHealthRecordType(record.record_type);
                  const Icon = RECORD_TYPE_ICONS[recordType];
                  return (
                    <div key={record.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-cream-50 transition-colors">
                      <div className={`flex items-center justify-center w-9 h-9 rounded-lg border shrink-0 ${RECORD_TYPE_COLORS[recordType]}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-900 truncate">{record.title}</p>
                          <span className={`badge border ${RECORD_TYPE_COLORS[recordType]}`}>
                            {RECORD_TYPE_LABELS[recordType]}
                          </span>
                        </div>
                        {record.provider && <p className="text-xs text-slate-500 mt-0.5">{record.provider}</p>}
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(record.event_date)} · {relativeTime(record.event_date)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Upcoming appointments */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title flex items-center gap-2 text-base">
                  <Calendar className="w-4 h-4 text-teal-700" /> Upcoming
                </h2>
                <Link to="/appointments" className="text-xs text-teal-700 font-medium hover:text-teal-800">View</Link>
              </div>
              {upcomingAppointments.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No upcoming appointments.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingAppointments.map((apt) => {
                    const days = daysUntil(apt.appointment_date);
                    return (
                      <div key={apt.id} className="p-3 rounded-xl bg-cream-50 border border-sage-100">
                        <p className="text-sm font-medium text-slate-900 break-words">{apt.title}</p>
                        {apt.provider && <p className="text-xs text-slate-500 mt-0.5">{apt.provider}</p>}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-teal-700 font-medium break-words">{formatDate(apt.appointment_date)}</span>
                          {days === 0 ? (
                            <span className="badge bg-rose-50 text-rose-700">Today</span>
                          ) : days <= 7 ? (
                            <span className="badge bg-amber-50 text-amber-700">In {days} days</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Allergies & Conditions */}
            <div className="card p-5">
              <h2 className="section-title flex items-center gap-2 text-base mb-3">
                <AlertCircle className="w-4 h-4 text-rose-600" /> Allergies & Conditions
              </h2>
              {allergies.length === 0 && conditions.length === 0 ? (
                <p className="text-sm text-slate-400 py-3 text-center">None recorded.</p>
              ) : (
                <div className="space-y-1.5">
                  {allergies.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <span className="badge bg-rose-50 text-rose-700 border border-rose-100">Allergy</span>
                      <span className="text-slate-700 break-words">{a.title}</span>
                    </div>
                  ))}
                  {conditions.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-sm">
                      <span className="badge bg-amber-50 text-amber-700 border border-amber-100">Condition</span>
                      <span className="text-slate-700 break-words">{c.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom row */}
      {!loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Active medications */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title flex items-center gap-2 text-base">
                <Pill className="w-4 h-4 text-sage-600" /> Active Medications
              </h2>
              <Link to="/medications" className="text-xs text-teal-700 font-medium hover:text-teal-800">View</Link>
            </div>
            {activeMedications.length === 0 ? (
              <p className="text-sm text-slate-400 py-3 text-center">No active medications.</p>
            ) : (
              <div className="space-y-2">
                {activeMedications.slice(0, 4).map((med) => (
                  <div key={med.id} className="flex items-center gap-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{med.name}</p>
                      <p className="text-xs text-slate-500">{med.dosage}{med.frequency ? ` · ${med.frequency}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vaccination summary */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title flex items-center gap-2 text-base">
                <Syringe className="w-4 h-4 text-teal-700" /> Vaccinations
              </h2>
              <Link to="/vaccinations" className="text-xs text-teal-700 font-medium hover:text-teal-800">View</Link>
            </div>
            {vaccinations.length === 0 ? (
              <p className="text-sm text-slate-400 py-3 text-center">No vaccinations recorded.</p>
            ) : (
              <div className="space-y-2">
                {vaccinations.slice(0, 3).map((v) => (
                  <div key={v.id} className="text-sm">
                    <p className="font-medium text-slate-900">{v.vaccine_name}</p>
                    <p className="text-xs text-slate-500">{formatDate(v.date_administered)}</p>
                  </div>
                ))}
                {nextVaccination && (
                  <div className="pt-2 mt-2 border-t border-slate-100">
                    <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Next due: {formatDate(nextVaccination.next_due_date)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Menstrual summary */}
          {profile?.menstrual_tracking_enabled && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title flex items-center gap-2 text-base">
                  <HeartPulse className="w-4 h-4 text-rose-500" /> Cycle Summary
                </h2>
                <Link to="/menstrual" className="text-xs text-teal-700 font-medium hover:text-teal-800">View</Link>
              </div>
              {menstrualLogs.length === 0 ? (
                <p className="text-sm text-slate-400 py-3 text-center">No period logs yet.</p>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm">
                    <p className="font-medium text-slate-900">Last period: {formatDate(latestPeriod?.period_start)}</p>
                    {latestPeriod?.flow_level && (
                      <p className="text-xs text-slate-500 capitalize">Flow: {latestPeriod.flow_level}</p>
                    )}
                  </div>
                  {menstrualLogs.length >= 2 && (
                    <div className="pt-2 mt-2 border-t border-slate-100">
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> {menstrualLogs.length} cycles logged
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  link,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  color: 'teal' | 'sage';
  link: string;
}) {
  const colorClasses = {
    teal: 'bg-teal-50 text-teal-700',
    sage: 'bg-sage-50 text-sage-700',
  };

  return (
    <Link to={link} className="card card-hover p-4 group">
      <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${colorClasses[color]} mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900">
        {value === null ? <span className="skeleton inline-block w-8 h-6" /> : value}
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </Link>
  );
}
