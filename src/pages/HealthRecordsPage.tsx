import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  FileText,
  Camera,
  Paperclip,
  Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast, ToastContainer } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { SkeletonList } from '@/components/Skeletons';
import { DocumentScannerModal } from '@/components/DocumentScannerModal';
import { DocumentViewerModal } from '@/components/DocumentViewerModal';
import { formatDate, toDateInputValue } from '@/lib/utils';
import { deleteDocument } from '@/lib/documents';
import {
  RECORD_TYPE_LABELS,
  RECORD_TYPE_ICONS,
  RECORD_TYPE_COLORS,
  SEVERITY_COLORS,
  normalizeHealthRecordType,
  mapCategoryToRecordType,
} from '@/lib/constants';
import type { HealthRecord, HealthRecordType, DocumentRecord } from '@/types/database';

const RECORD_TYPES = Object.keys(RECORD_TYPE_LABELS) as HealthRecordType[];

export type TimelineItem =
  | {
      id: string;
      kind: 'record';
      title: string;
      date: string;
      recordType: HealthRecordType;
      description: string | null;
      provider: string | null;
      severity: 'mild' | 'moderate' | 'severe' | null;
      attachedDocs: DocumentRecord[];
      rawRecord: HealthRecord;
    }
  | {
      id: string;
      kind: 'document';
      title: string;
      date: string;
      recordType: HealthRecordType;
      description: string | null;
      provider: string | null;
      severity: null;
      attachedDocs: DocumentRecord[];
      rawDocument: DocumentRecord;
    };

export function HealthRecordsPage() {
  const { user } = useAuth();
  const { toasts, success, error, dismiss } = useToast();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [linkedDocuments, setLinkedDocuments] = useState<Record<string, DocumentRecord[]>>({});
  const [unlinkedDocuments, setUnlinkedDocuments] = useState<DocumentRecord[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<HealthRecordType | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<HealthRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Document Scanner & Viewer modals
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerRecordId, setScannerRecordId] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<DocumentRecord | null>(null);

  // Form state
  const [formType, setFormType] = useState<HealthRecordType>('doctor_visit');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formProvider, setFormProvider] = useState('');
  const [formSeverity, setFormSeverity] = useState('');

  const loadRecords = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [recordsRes, docsRes] = await Promise.all([
        supabase
          .from('health_records')
          .select('*')
          .eq('user_id', user.id)
          .order('event_date', { ascending: false }),
        supabase
          .from('documents')
          .select('*')
          .eq('user_id', user.id),
      ]);

      if (recordsRes.error) throw recordsRes.error;
      setRecords((recordsRes.data ?? []) as HealthRecord[]);

      // Map linked documents by health_record_id and track unlinked standalone documents
      const docMap: Record<string, DocumentRecord[]> = {};
      const standaloneDocs: DocumentRecord[] = [];
      if (docsRes.data) {
        (docsRes.data as DocumentRecord[]).forEach((d) => {
          if (d.health_record_id) {
            if (!docMap[d.health_record_id]) docMap[d.health_record_id] = [];
            docMap[d.health_record_id].push(d);
          } else {
            standaloneDocs.push(d);
          }
        });
      }
      setLinkedDocuments(docMap);
      setUnlinkedDocuments(standaloneDocs);
    } catch (err: unknown) {
      console.error('Health records database error:', err);
      error(err instanceof Error ? err.message : 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [user, error]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Combine records and standalone documents into a unified, chronologically sorted timeline
  const timelineItems: TimelineItem[] = [
    ...records.map((r) => ({
      id: r.id,
      kind: 'record' as const,
      title: r.title,
      date: r.event_date,
      recordType: normalizeHealthRecordType(r.record_type),
      description: r.description,
      provider: r.provider,
      severity: r.severity,
      attachedDocs: linkedDocuments[r.id] || [],
      rawRecord: r,
    })),
    ...unlinkedDocuments.map((d) => ({
      id: d.id,
      kind: 'document' as const,
      title: d.title,
      date: d.document_date || (d.uploaded_at ? d.uploaded_at.split('T')[0] : new Date().toISOString().split('T')[0]),
      recordType: mapCategoryToRecordType(d.category),
      description: d.extracted_text?.trim()
        ? d.extracted_text.trim().slice(0, 240) + (d.extracted_text.trim().length > 240 ? '...' : '')
        : `Uploaded ${d.category} document`,
      provider: null,
      severity: null,
      attachedDocs: [d],
      rawDocument: d,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredItems = timelineItems.filter((item) => {
    const matchesSearch =
      !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.description?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (item.provider?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesType = typeFilter === 'all' || item.recordType === typeFilter;
    return matchesSearch && matchesType;
  });

  const openCreateModal = () => {
    setEditingRecord(null);
    setFormType('doctor_visit');
    setFormTitle('');
    setFormDescription('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormProvider('');
    setFormSeverity('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (record: HealthRecord) => {
    setEditingRecord(record);
    setFormType(normalizeHealthRecordType(record.record_type));
    setFormTitle(record.title);
    setFormDescription(record.description || '');
    setFormDate(toDateInputValue(record.event_date));
    setFormProvider(record.provider || '');
    setFormSeverity(record.severity || '');
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setFormError(null);

    if (!formTitle.trim()) {
      setFormError('Title is required.');
      setSaving(false);
      return;
    }
    if (!formDate) {
      setFormError('Date is required.');
      setSaving(false);
      return;
    }

    const payload = {
      record_type: formType,
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      event_date: formDate,
      provider: formProvider.trim() || null,
      severity: formSeverity || null,
    };

    if (editingRecord) {
      const { error: updateError } = await supabase
        .from('health_records')
        .update(payload)
        .eq('id', editingRecord.id)
        .eq('user_id', user.id);

      if (updateError) {
        setFormError(updateError.message);
        setSaving(false);
        return;
      }
      success('Health record updated successfully.');
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('health_records')
        .insert({ ...payload, user_id: user.id })
        .select()
        .single();

      if (insertError) {
        setFormError(insertError.message);
        setSaving(false);
        return;
      }
      success('Health record added successfully.');
    }

    setModalOpen(false);
    setSaving(false);
    loadRecords();
  };

  const handleDelete = async () => {
    if (!deleteId || !user) return;
    const { error: deleteError } = await supabase
      .from('health_records')
      .delete()
      .eq('id', deleteId)
      .eq('user_id', user.id);

    if (deleteError) {
      error('Failed to delete record.');
    } else {
      success('Record deleted.');
      loadRecords();
    }
    setDeleteId(null);
  };

  const handleDocumentAttached = (savedDoc: DocumentRecord) => {
    success(`Document "${savedDoc.title}" attached to health record.`);
    loadRecords();
  };

  const handleDeleteDocument = async (doc: DocumentRecord) => {
    if (!window.confirm(`Are you sure you want to delete "${doc.title}"?`)) return;
    try {
      await deleteDocument(doc);
      success('Document deleted successfully.');
      loadRecords();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Health Records
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            All your medical events, doctor visits, tests, and documents in one timeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setScannerRecordId(null);
              setScannerOpen(true);
            }}
            className="btn btn-secondary text-sm"
          >
            <Camera className="w-4 h-4" /> Scan Report
          </button>
          <button onClick={openCreateModal} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Add Record
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search records, descriptions, or providers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as HealthRecordType | 'all')}
            className="input pl-10 pr-8 appearance-none cursor-pointer"
          >
            <option value="all">All Types</option>
            {RECORD_TYPES.map((t) => (
              <option key={t} value={t}>
                {RECORD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Records list */}
      {loading ? (
        <SkeletonList count={5} />
      ) : filteredItems.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={<FileText className="w-7 h-7" />}
            title={
              search || typeFilter !== 'all'
                ? 'No matching records'
                : 'No health records yet'
            }
            description={
              search || typeFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Add your first health record or scan a report to start building your medical timeline.'
            }
            action={
              !search && typeFilter === 'all' ? (
                <button onClick={openCreateModal} className="btn-primary text-sm">
                  <Plus className="w-4 h-4" /> Add Record
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const recordType = item.recordType;
            const Icon = RECORD_TYPE_ICONS[recordType] || FileText;
            const attachedDocs = item.attachedDocs;

            return (
              <div key={item.id} className="card card-hover p-4 group">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-xl border shrink-0 ${RECORD_TYPE_COLORS[recordType] || 'bg-slate-50 text-slate-700 border-slate-100'}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900 break-words">
                        {item.title}
                      </h3>
                      <span className={`badge border ${RECORD_TYPE_COLORS[recordType]}`}>
                        {RECORD_TYPE_LABELS[recordType]}
                      </span>
                      {item.kind === 'document' && (
                        <span className="badge bg-teal-50 text-teal-700 border-teal-200">
                          Document
                        </span>
                      )}
                      {item.severity && (
                        <span className={`badge border ${SEVERITY_COLORS[item.severity]}`}>
                          {item.severity}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-sm text-slate-600 mt-1 line-clamp-2 break-words">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                      <span>{formatDate(item.date)}</span>
                      {item.provider && <span className="break-words">· {item.provider}</span>}
                    </div>

                    {/* Attached Documents Pills / View Document Button */}
                    {attachedDocs.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mt-2.5 pt-2 border-t border-slate-100">
                        <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                          <Paperclip className="w-3 h-3 text-teal-600" />
                          {item.kind === 'document' ? 'File:' : `Attached (${attachedDocs.length}):`}
                        </span>
                        {attachedDocs.map((doc) => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => setViewingDoc(doc)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 transition-colors"
                          >
                            <FileText className="w-3 h-3" />
                            <span className="max-w-[150px] truncate">{doc.title}</span>
                            <Eye className="w-3 h-3 text-teal-600 opacity-60" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                    {item.kind === 'record' ? (
                      <>
                        <button
                          type="button"
                          aria-label="Attach Document"
                          title="Attach or Scan Document"
                          onClick={() => {
                            setScannerRecordId(item.id);
                            setScannerOpen(true);
                          }}
                          className="p-2 rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit ${item.title}`}
                          onClick={() => openEditModal(item.rawRecord)}
                          className="p-2 rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${item.title}`}
                          onClick={() => setDeleteId(item.id)}
                          className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-label={`View ${item.title}`}
                          title="View Document"
                          onClick={() => setViewingDoc(item.rawDocument)}
                          className="p-2 rounded-lg text-teal-600 hover:bg-teal-50"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${item.title}`}
                          title="Delete Document"
                          onClick={() => handleDeleteDocument(item.rawDocument)}
                          className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRecord ? 'Edit Record' : 'Add Health Record'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <ErrorBanner message={formError} />}

          <div>
            <label className="label" htmlFor="recordType">
              Record type
            </label>
            <select
              id="recordType"
              value={formType}
              onChange={(e) => setFormType(e.target.value as HealthRecordType)}
              className="input cursor-pointer"
            >
              {RECORD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RECORD_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="recordTitle">
              Title *
            </label>
            <input
              id="recordTitle"
              type="text"
              required
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="input"
              placeholder="e.g., Annual physical exam"
            />
          </div>

          <div>
            <label className="label" htmlFor="recordDate">
              Date *
            </label>
            <input
              id="recordDate"
              type="date"
              required
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="recordProvider">
              Provider / Doctor
            </label>
            <input
              id="recordProvider"
              type="text"
              value={formProvider}
              onChange={(e) => setFormProvider(e.target.value)}
              className="input"
              placeholder="e.g., Dr. Smith, City Hospital"
            />
          </div>

          <div>
            <label className="label" htmlFor="recordSeverity">
              Severity (optional)
            </label>
            <select
              id="recordSeverity"
              value={formSeverity}
              onChange={(e) => setFormSeverity(e.target.value)}
              className="input cursor-pointer"
            >
              <option value="">None</option>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="recordDescription">
              Description / Notes
            </label>
            <textarea
              id="recordDescription"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="input min-h-[80px] resize-y"
              placeholder="Details about the visit, diagnosis, treatment, etc."
            />
          </div>

          {editingRecord && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setScannerRecordId(editingRecord.id);
                  setScannerOpen(true);
                }}
                className="w-full btn btn-secondary text-xs flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" /> Scan or Attach Document to this Record
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-ghost flex-1"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : editingRecord ? 'Update' : 'Add Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete record?"
        maxWidth="max-w-sm"
      >
        <p className="text-sm text-slate-600 mb-4">
          This will permanently delete this health record. Any attached documents will remain in your Documents vault.
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

      {/* Document Scanner Modal */}
      {user && (
        <DocumentScannerModal
          open={scannerOpen}
          onClose={() => {
            setScannerOpen(false);
            setScannerRecordId(null);
          }}
          userId={user.id}
          initialHealthRecordId={scannerRecordId}
          onSuccess={handleDocumentAttached}
        />
      )}

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        document={viewingDoc}
        open={Boolean(viewingDoc)}
        onClose={() => setViewingDoc(null)}
        onDeleted={() => {
          loadRecords();
        }}
      />
    </div>
  );
}
