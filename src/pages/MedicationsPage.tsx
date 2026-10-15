import { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Pill, Clock, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast, ToastContainer } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { SkeletonList } from '@/components/Skeletons';
import { formatDate, toDateInputValue } from '@/lib/utils';
import type { Medication } from '@/types/database';

export function MedicationsPage() {
  const { user } = useAuth();
  const { toasts, success, error, dismiss } = useToast();
  const [loading, setLoading] = useState(true);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [prescriber, setPrescriber] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);

  const loadMedications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false });

    if (queryError) {
      error('Failed to load medications.');
    } else {
      setMedications(data as Medication[]);
    }
    setLoading(false);
  }, [user, error]);

  useEffect(() => {
    loadMedications();
  }, [loadMedications]);

  const filteredMeds = showInactive ? medications : medications.filter((m) => m.active);

  const openCreateModal = () => {
    setEditingMed(null);
    setName('');
    setDosage('');
    setFrequency('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setPrescriber('');
    setNotes('');
    setActive(true);
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
    setFormError(null);
    setModalOpen(true);
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
    };

    if (editingMed) {
      const { error: updateError } = await supabase.from('medications').update(payload).eq('id', editingMed.id).eq('user_id', user.id);
      if (updateError) { setFormError(updateError.message); setSaving(false); return; }
      success('Medication updated.');
    } else {
      const { error: insertError } = await supabase.from('medications').insert({ ...payload, user_id: user.id });
      if (insertError) { setFormError(insertError.message); setSaving(false); return; }
      success('Medication added.');
    }

    setModalOpen(false);
    setSaving(false);
    loadMedications();
  };

  const handleDelete = async () => {
    if (!deleteId || !user) return;
    const { error: deleteError } = await supabase.from('medications').delete().eq('id', deleteId).eq('user_id', user.id);
    if (deleteError) { error('Failed to delete.'); } else { success('Medication deleted.'); loadMedications(); }
    setDeleteId(null);
  };

  const toggleActive = async (med: Medication) => {
    if (!user) return;
    const { error: updateError } = await supabase.from('medications').update({ active: !med.active }).eq('id', med.id).eq('user_id', user.id);
    if (updateError) { error('Failed to update.'); } else { loadMedications(); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Medications</h1>
          <p className="text-sm text-slate-500 mt-1">Track your current and past medications.</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Medication
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowInactive(false)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!showInactive ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
        >
          Active
        </button>
        <button
          onClick={() => setShowInactive(true)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${showInactive ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
        >
          All
        </button>
      </div>

      {loading ? (
        <SkeletonList count={4} />
      ) : filteredMeds.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={<Pill className="w-7 h-7" />}
            title="No medications recorded"
            description="Add your current medications to keep track of dosages and schedules."
            action={<button onClick={openCreateModal} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Add Medication</button>}
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filteredMeds.map((med) => (
            <div key={med.id} className="card card-hover p-4 group">
              <div className="flex items-start gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${med.active ? 'bg-sage-50 text-sage-700' : 'bg-slate-50 text-slate-400'}`}>
                  <Pill className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-900 break-words">{med.name}</h3>
                    {med.active ? (
                      <span className="badge bg-sage-50 text-sage-700 border border-sage-100">Active</span>
                    ) : (
                      <span className="badge bg-slate-50 text-slate-500 border border-slate-100">Inactive</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5 break-words">{med.dosage}</p>
                  {med.frequency && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" /> {med.frequency}
                    </p>
                  )}
                  {med.notes && <p className="text-sm text-slate-600 mt-1 break-words">{med.notes}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(med.start_date)}</span>
                    {med.end_date && <span>to {formatDate(med.end_date)}</span>}
                  </div>
                  {med.prescriber && <p className="text-xs text-slate-500 mt-1">Prescribed by {med.prescriber}</p>}
                </div>
                <div className="flex flex-col items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                  <button aria-label={`Edit ${med.name}`} onClick={() => openEditModal(med)} className="p-1.5 rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-700">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => toggleActive(med)} className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 text-xs">
                    {med.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button aria-label={`Delete ${med.name}`} onClick={() => setDeleteId(med.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingMed ? 'Edit Medication' : 'Add Medication'}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <ErrorBanner message={formError} />}
          <div>
            <label className="label" htmlFor="medName">Medication name *</label>
            <input id="medName" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g., Lisinopril" />
          </div>
          <div>
            <label className="label" htmlFor="medDosage">Dosage *</label>
            <input id="medDosage" type="text" required value={dosage} onChange={(e) => setDosage(e.target.value)} className="input" placeholder="e.g., 10mg once daily" />
          </div>
          <div>
            <label className="label" htmlFor="medFrequency">Frequency</label>
            <input id="medFrequency" type="text" value={frequency} onChange={(e) => setFrequency(e.target.value)} className="input" placeholder="e.g., Twice a day with meals" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="medStart">Start date *</label>
              <input id="medStart" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="medEnd">End date (optional)</label>
              <input id="medEnd" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="medPrescriber">Prescribed by</label>
            <input id="medPrescriber" type="text" value={prescriber} onChange={(e) => setPrescriber(e.target.value)} className="input" placeholder="e.g., Dr. Smith" />
          </div>
          <div>
            <label className="label" htmlFor="medNotes">Instructions</label>
            <textarea id="medNotes" value={notes} onChange={(e) => setNotes(e.target.value)} className="input min-h-[60px] resize-y" placeholder="How and when to take this medication..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 rounded text-teal-700 focus:ring-teal-500/20" />
            <span className="text-sm text-slate-700">Active medication</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : editingMed ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete medication?" maxWidth="max-w-sm">
        <p className="text-sm text-slate-600 mb-4">This will permanently delete this medication record.</p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteId(null)} className="btn-ghost flex-1">Cancel</button>
          <button onClick={handleDelete} className="btn-danger flex-1"><Trash2 className="w-4 h-4" /> Delete</button>
        </div>
      </Modal>
    </div>
  );
}
