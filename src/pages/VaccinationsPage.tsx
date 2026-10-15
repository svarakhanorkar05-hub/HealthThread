import { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Syringe, Calendar, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast, ToastContainer } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { SkeletonList } from '@/components/Skeletons';
import { formatDate, toDateInputValue, daysUntil } from '@/lib/utils';
import type { Vaccination } from '@/types/database';

export function VaccinationsPage() {
  const { user } = useAuth();
  const { toasts, success, error, dismiss } = useToast();
  const [loading, setLoading] = useState(true);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVacc, setEditingVacc] = useState<Vaccination | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [vaccineName, setVaccineName] = useState('');
  const [doseNumber, setDoseNumber] = useState('');
  const [dateAdministered, setDateAdministered] = useState('');
  const [provider, setProvider] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const loadVaccinations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('vaccinations')
      .select('*')
      .eq('user_id', user.id)
      .order('date_administered', { ascending: false });

    if (queryError) { error('Failed to load vaccinations.'); }
    else { setVaccinations(data as Vaccination[]); }
    setLoading(false);
  }, [user, error]);

  useEffect(() => { loadVaccinations(); }, [loadVaccinations]);

  const upcomingVaccines = vaccinations.filter((v) => v.next_due_date && daysUntil(v.next_due_date) > 0);

  const openCreateModal = () => {
    setEditingVacc(null);
    setVaccineName(''); setDoseNumber(''); setDateAdministered(new Date().toISOString().split('T')[0]);
    setProvider(''); setNextDueDate(''); setNotes('');
    setFormError(null); setModalOpen(true);
  };

  const openEditModal = (vacc: Vaccination) => {
    setEditingVacc(vacc);
    setVaccineName(vacc.vaccine_name);
    setDoseNumber(vacc.dose_number?.toString() || '');
    setDateAdministered(toDateInputValue(vacc.date_administered));
    setProvider(vacc.provider || '');
    setNextDueDate(toDateInputValue(vacc.next_due_date));
    setNotes(vacc.notes || '');
    setFormError(null); setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true); setFormError(null);

    if (!vaccineName.trim() || !dateAdministered) {
      setFormError('Vaccine name and date administered are required.');
      setSaving(false); return;
    }
    if (doseNumber && (!Number.isInteger(Number(doseNumber)) || Number(doseNumber) < 1)) {
      setFormError('Dose number must be a positive whole number.');
      setSaving(false); return;
    }
    if (nextDueDate && nextDueDate < dateAdministered) {
      setFormError('Next due date cannot be earlier than the administration date.');
      setSaving(false); return;
    }

    const payload = {
      vaccine_name: vaccineName.trim(),
      dose_number: doseNumber ? parseInt(doseNumber) : null,
      date_administered: dateAdministered,
      provider: provider.trim() || null,
      next_due_date: nextDueDate || null,
      notes: notes.trim() || null,
    };

    if (editingVacc) {
      const { error: updateError } = await supabase.from('vaccinations').update(payload).eq('id', editingVacc.id).eq('user_id', user.id);
      if (updateError) { setFormError(updateError.message); setSaving(false); return; }
      success('Vaccination updated.');
    } else {
      const { error: insertError } = await supabase.from('vaccinations').insert({ ...payload, user_id: user.id });
      if (insertError) { setFormError(insertError.message); setSaving(false); return; }
      success('Vaccination added.');
    }

    setModalOpen(false); setSaving(false); loadVaccinations();
  };

  const handleDelete = async () => {
    if (!deleteId || !user) return;
    const { error: deleteError } = await supabase.from('vaccinations').delete().eq('id', deleteId).eq('user_id', user.id);
    if (deleteError) { error('Failed to delete.'); } else { success('Vaccination deleted.'); loadVaccinations(); }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vaccinations</h1>
          <p className="text-sm text-slate-500 mt-1">Your immunization history and upcoming doses.</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Vaccination
        </button>
      </div>

      {upcomingVaccines.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Upcoming vaccinations due:</p>
            <ul className="text-xs mt-1 space-y-0.5">
              {upcomingVaccines.map((v) => (
                <li key={v.id}>{v.vaccine_name} — due {formatDate(v.next_due_date)} (in {daysUntil(v.next_due_date!)} days)</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonList count={4} />
      ) : vaccinations.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={<Syringe className="w-7 h-7" />}
            title="No vaccinations recorded"
            description="Add your vaccination history to keep track of immunizations and booster schedules."
            action={<button onClick={openCreateModal} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Add Vaccination</button>}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {vaccinations.map((vacc) => {
            const isUpcoming = vacc.next_due_date && daysUntil(vacc.next_due_date) > 0;
            return (
              <div key={vacc.id} className="card card-hover p-4 group">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-50 text-teal-700 shrink-0">
                    <Syringe className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900 break-words">{vacc.vaccine_name}</h3>
                      {vacc.dose_number && <span className="badge bg-teal-50 text-teal-700 border border-teal-100">Dose {vacc.dose_number}</span>}
                      {isUpcoming && <span className="badge bg-amber-50 text-amber-700 border border-amber-100">Due in {daysUntil(vacc.next_due_date!)} days</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(vacc.date_administered)}</span>
                      {vacc.provider && <span>· {vacc.provider}</span>}
                    </div>
                    {vacc.next_due_date && (
                      <p className="text-xs text-slate-500 mt-1">Next due: {formatDate(vacc.next_due_date)}</p>
                    )}
                    {vacc.notes && <p className="text-sm text-slate-600 mt-1 break-words">{vacc.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                    <button aria-label={`Edit ${vacc.vaccine_name}`} onClick={() => openEditModal(vacc)} className="p-2 rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-700">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button aria-label={`Delete ${vacc.vaccine_name}`} onClick={() => setDeleteId(vacc.id)} className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingVacc ? 'Edit Vaccination' : 'Add Vaccination'}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <ErrorBanner message={formError} />}
          <div>
            <label className="label" htmlFor="vaccName">Vaccine name *</label>
            <input id="vaccName" type="text" required value={vaccineName} onChange={(e) => setVaccineName(e.target.value)} className="input" placeholder="e.g., Influenza (Flu)" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="vaccDose">Dose number</label>
              <input id="vaccDose" type="number" min="1" step="1" value={doseNumber} onChange={(e) => setDoseNumber(e.target.value)} className="input" placeholder="1" />
            </div>
            <div>
              <label className="label" htmlFor="vaccDate">Date administered *</label>
              <input id="vaccDate" type="date" required value={dateAdministered} onChange={(e) => setDateAdministered(e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="vaccProvider">Provider</label>
            <input id="vaccProvider" type="text" value={provider} onChange={(e) => setProvider(e.target.value)} className="input" placeholder="e.g., City Health Clinic" />
          </div>
          <div>
            <label className="label" htmlFor="vaccNext">Next due date (optional)</label>
            <input id="vaccNext" type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="vaccNotes">Notes</label>
            <textarea id="vaccNotes" value={notes} onChange={(e) => setNotes(e.target.value)} className="input min-h-[60px] resize-y" placeholder="Batch number, reactions, etc." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : editingVacc ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete vaccination?" maxWidth="max-w-sm">
        <p className="text-sm text-slate-600 mb-4">This will permanently delete this vaccination record.</p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteId(null)} className="btn-ghost flex-1">Cancel</button>
          <button onClick={handleDelete} className="btn-danger flex-1"><Trash2 className="w-4 h-4" /> Delete</button>
        </div>
      </Modal>
    </div>
  );
}
