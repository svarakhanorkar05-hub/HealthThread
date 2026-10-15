import { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Calendar, MapPin, Clock, User as UserIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast, ToastContainer } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { SkeletonList } from '@/components/Skeletons';
import { formatDateTime, toDateTimeInputValue, daysUntil } from '@/lib/utils';
import type { Appointment } from '@/types/database';

export function AppointmentsPage() {
  const { user } = useAuth();
  const { toasts, success, error, dismiss } = useToast();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dateFilter, setDateFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [location, setLocation] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [notes, setNotes] = useState('');

  const loadAppointments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase.from('appointments').select('*').eq('user_id', user.id).order('appointment_date', { ascending: dateFilter === 'upcoming' });
    if (dateFilter === 'upcoming') {
      query = query.gte('appointment_date', new Date().toISOString()).neq('status', 'cancelled');
    } else if (dateFilter === 'past') {
      query = query.lt('appointment_date', new Date().toISOString());
    }
    const { data, error: queryError } = await query;

    if (queryError) { error('Failed to load appointments.'); }
    else { setAppointments(data as Appointment[]); }
    setLoading(false);
  }, [user, dateFilter, error]);

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  const openCreateModal = () => {
    setEditingApt(null);
    setTitle(''); setProvider(''); setSpecialty(''); setLocation('');
    setAppointmentDate(''); setReason(''); setStatus('upcoming'); setNotes('');
    setFormError(null); setModalOpen(true);
  };

  const openEditModal = (apt: Appointment) => {
    setEditingApt(apt);
    setTitle(apt.title); setProvider(apt.provider || ''); setSpecialty(apt.specialty || ''); setLocation(apt.location || '');
    setAppointmentDate(toDateTimeInputValue(apt.appointment_date));
    setReason(apt.reason || ''); setStatus(apt.status); setNotes(apt.notes || '');
    setFormError(null); setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true); setFormError(null);

    if (!title.trim() || !appointmentDate) {
      setFormError('Title and date/time are required.');
      setSaving(false); return;
    }

    const payload = {
      title: title.trim(),
      provider: provider.trim() || null,
      specialty: specialty.trim() || null,
      location: location.trim() || null,
      appointment_date: appointmentDate,
      reason: reason.trim() || null,
      status,
      notes: notes.trim() || null,
    };

    if (editingApt) {
      const { error: updateError } = await supabase.from('appointments').update(payload).eq('id', editingApt.id).eq('user_id', user.id);
      if (updateError) { setFormError(updateError.message); setSaving(false); return; }
      success('Appointment updated.');
    } else {
      const { error: insertError } = await supabase.from('appointments').insert({ ...payload, user_id: user.id });
      if (insertError) { setFormError(insertError.message); setSaving(false); return; }
      success('Appointment added.');
    }

    setModalOpen(false); setSaving(false); loadAppointments();
  };

  const handleDelete = async () => {
    if (!deleteId || !user) return;
    const { error: deleteError } = await supabase.from('appointments').delete().eq('id', deleteId).eq('user_id', user.id);
    if (deleteError) { error('Failed to delete.'); } else { success('Appointment deleted.'); loadAppointments(); }
    setDeleteId(null);
  };

  const markComplete = async (apt: Appointment) => {
    if (!user) return;
    const { error: updateError } = await supabase.from('appointments').update({ status: 'completed' }).eq('id', apt.id).eq('user_id', user.id);
    if (updateError) { error('Failed to update.'); } else { success('Marked as completed.'); loadAppointments(); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Appointments</h1>
          <p className="text-sm text-slate-500 mt-1">Schedule and track your medical appointments.</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Appointment
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(['upcoming', 'past', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setDateFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${dateFilter === s ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList count={4} />
      ) : appointments.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={<Calendar className="w-7 h-7" />}
            title={`No ${dateFilter} appointments`}
            description="Schedule a new appointment to keep track of upcoming visits."
            action={<button onClick={openCreateModal} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Add Appointment</button>}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {appointments.map((apt) => {
            const days = daysUntil(apt.appointment_date);
            return (
              <div key={apt.id} className="card card-hover p-4 group">
                <div className="flex items-start gap-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
                    apt.status === 'upcoming' ? 'bg-teal-50 text-teal-700' :
                    apt.status === 'completed' ? 'bg-sage-50 text-sage-700' :
                    'bg-slate-50 text-slate-400'
                  }`}>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900 break-words">{apt.title}</h3>
                      <span className={`badge capitalize ${
                        apt.status === 'upcoming' ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                        apt.status === 'completed' ? 'bg-sage-50 text-sage-700 border border-sage-100' :
                        'bg-slate-50 text-slate-500 border border-slate-100'
                      }`}>{apt.status}</span>
                      {apt.status === 'upcoming' && days === 0 && <span className="badge bg-rose-50 text-rose-700 border border-rose-100">Today</span>}
                      {apt.status === 'upcoming' && days > 0 && days <= 7 && <span className="badge bg-amber-50 text-amber-700 border border-amber-100">In {days} days</span>}
                    </div>
                    <div className="flex flex-col gap-1 mt-1.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1 break-words"><Clock className="w-3 h-3 shrink-0" /> {formatDateTime(apt.appointment_date)}</span>
                      {apt.provider && <span className="flex items-center gap-1 break-words"><UserIcon className="w-3 h-3 shrink-0" /> {apt.provider}</span>}
                      {apt.specialty && <span className="break-words">{apt.specialty}</span>}
                      {apt.location && <span className="flex items-center gap-1 break-words"><MapPin className="w-3 h-3 shrink-0" /> {apt.location}</span>}
                    </div>
                    {apt.reason && <p className="text-sm text-slate-600 mt-1 break-words">{apt.reason}</p>}
                    {apt.notes && <p className="text-sm text-slate-500 mt-1 break-words">{apt.notes}</p>}
                  </div>
                  <div className="flex flex-col items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                    {apt.status === 'upcoming' && (
                      <button onClick={() => markComplete(apt)} className="text-xs px-2 py-1 rounded-lg text-sage-600 hover:bg-sage-50 font-medium">
                        Complete
                      </button>
                    )}
                    <button onClick={() => openEditModal(apt)} className="p-1.5 rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-700">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(apt.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingApt ? 'Edit Appointment' : 'Add Appointment'}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <ErrorBanner message={formError} />}
          <div>
            <label className="label" htmlFor="aptTitle">Appointment *</label>
            <input id="aptTitle" type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="e.g., Annual checkup" />
          </div>
          <div>
            <label className="label" htmlFor="aptDate">Date & time *</label>
            <input id="aptDate" type="datetime-local" required value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="aptProvider">Provider / Doctor</label>
            <input id="aptProvider" type="text" value={provider} onChange={(e) => setProvider(e.target.value)} className="input" placeholder="e.g., Dr. Smith" />
          </div>
          <div>
            <label className="label" htmlFor="aptSpecialty">Specialty</label>
            <input id="aptSpecialty" type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="input" placeholder="e.g., Cardiology" />
          </div>
          <div>
            <label className="label" htmlFor="aptLocation">Location</label>
            <input id="aptLocation" type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="input" placeholder="e.g., City Medical Center" />
          </div>
          <div>
            <label className="label" htmlFor="aptReason">Reason for visit</label>
            <input id="aptReason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder="e.g., Routine physical" />
          </div>
          <div>
            <label className="label" htmlFor="aptStatus">Status</label>
            <select id="aptStatus" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input cursor-pointer">
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="aptNotes">Notes</label>
            <textarea id="aptNotes" value={notes} onChange={(e) => setNotes(e.target.value)} className="input min-h-[60px] resize-y" placeholder="Additional notes..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : editingApt ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete appointment?" maxWidth="max-w-sm">
        <p className="text-sm text-slate-600 mb-4">This will permanently delete this appointment.</p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteId(null)} className="btn-ghost flex-1">Cancel</button>
          <button onClick={handleDelete} className="btn-danger flex-1"><Trash2 className="w-4 h-4" /> Delete</button>
        </div>
      </Modal>
    </div>
  );
}
