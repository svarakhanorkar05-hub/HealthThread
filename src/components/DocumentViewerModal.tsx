import { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Trash2,
  Calendar,
  Tag,
  ExternalLink,
  Copy,
  Check,
  Edit2,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import {
  getDocumentSignedUrl,
  deleteDocument,
} from '@/lib/documents';
import { formatDate } from '@/lib/utils';
import { DOCUMENT_CATEGORY_COLORS, DOCUMENT_CATEGORIES } from '@/lib/constants';
import type { DocumentRecord, DocumentCategory, HealthRecord } from '@/types/database';
import { supabase } from '@/lib/supabase';

interface DocumentViewerModalProps {
  document: DocumentRecord | null;
  open: boolean;
  onClose: () => void;
  onDeleted?: (id: string) => void;
  onUpdated?: (updated: DocumentRecord) => void;
}

export function DocumentViewerModal({
  document,
  open,
  onClose,
  onDeleted,
  onUpdated,
}: DocumentViewerModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  // Edit metadata mode
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<DocumentCategory>('Other');
  const [editDate, setEditDate] = useState('');
  const [editRecordId, setEditRecordId] = useState('');
  const [userRecords, setUserRecords] = useState<HealthRecord[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || !document) {
      setSignedUrl(null);
      setIsEditing(false);
      setConfirmDelete(false);
      setErrorMsg(null);
      return;
    }

    setEditTitle(document.title);
    setEditCategory(document.category || 'Other');
    setEditDate(document.document_date || '');
    setEditRecordId(document.health_record_id || '');

    // Fetch signed URL for viewing
    setLoadingUrl(true);
    getDocumentSignedUrl(document.file_path, 3600)
      .then((url) => {
        setSignedUrl(url);
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : 'Could not generate secure view link');
      })
      .finally(() => {
        setLoadingUrl(false);
      });

    // Fetch user records for linking
    if (document.user_id) {
      supabase
        .from('health_records')
        .select('*')
        .eq('user_id', document.user_id)
        .order('event_date', { ascending: false })
        .then(({ data }) => {
          if (data) setUserRecords(data as HealthRecord[]);
        });
    }
  }, [open, document]);

  if (!document) return null;

  const isPdf =
    document.mime_type === 'application/pdf' ||
    document.original_filename?.toLowerCase().endsWith('.pdf') ||
    document.file_path.toLowerCase().endsWith('.pdf');

  const copyExtractedText = () => {
    if (!document.extracted_text) return;
    navigator.clipboard.writeText(document.extracted_text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDocument(document);
      onDeleted?.(document.id);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete document');
      setDeleting(false);
    }
  };

  const handleSaveMetadata = async () => {
    if (!editTitle.trim()) return;
    setSavingEdit(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .update({
          title: editTitle.trim(),
          category: editCategory,
          document_date: editDate || null,
          health_record_id: editRecordId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', document.id)
        .select()
        .single();

      if (error) throw error;
      onUpdated?.(data as DocumentRecord);
      setIsEditing(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update document details');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Document Details' : document.title}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {isEditing ? (
          /* EDIT METADATA MODE */
          <div className="space-y-3 py-2">
            <div>
              <label className="label">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as DocumentCategory)}
                  className="input"
                >
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Document Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="label">Linked Health Event</label>
              <select
                value={editRecordId}
                onChange={(e) => setEditRecordId(e.target.value)}
                className="input"
              >
                <option value="">-- No specific event linked --</option>
                {userRecords.map((rec) => (
                  <option key={rec.id} value={rec.id}>
                    {rec.event_date} — {rec.title} ({rec.record_type})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMetadata}
                disabled={savingEdit}
                className="btn btn-primary"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          /* VIEW MODE */
          <div className="space-y-4">
            {/* Header info pills */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`px-2.5 py-1 rounded-full font-medium border ${
                    DOCUMENT_CATEGORY_COLORS[document.category] || 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {document.category}
                </span>

                {document.document_date && (
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    Date: {formatDate(document.document_date)}
                  </span>
                )}

                <span className="text-slate-400">
                  {document.file_size ? `${(document.file_size / 1024).toFixed(0)} KB` : ''}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="btn btn-ghost px-2.5 py-1.5 text-xs"
                  title="Edit metadata"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>

                {signedUrl && (
                  <a
                    href={signedUrl}
                    download={document.original_filename || document.title}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary px-2.5 py-1.5 text-xs"
                    title="Download document"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="btn btn-danger px-2.5 py-1.5 text-xs"
                  title="Delete document"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Document Preview Container */}
            <div className="rounded-xl overflow-hidden bg-slate-100 border min-h-[320px] max-h-[60vh] flex items-center justify-center relative">
              {loadingUrl ? (
                <div className="flex flex-col items-center gap-2 p-8 text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                  <span className="text-sm">Loading secure preview...</span>
                </div>
              ) : signedUrl ? (
                isPdf ? (
                  <iframe
                    src={`${signedUrl}#toolbar=1`}
                    title={document.title}
                    className="w-full h-[55vh] border-0"
                  />
                ) : (
                  <div className="w-full h-full p-2 flex items-center justify-center overflow-auto max-h-[55vh]">
                    <img
                      src={signedUrl}
                      alt={document.title}
                      className="max-w-full max-h-[52vh] object-contain rounded-lg shadow-sm"
                    />
                  </div>
                )
              ) : (
                <div className="text-center p-8 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm">Preview unavailable</p>
                </div>
              )}
            </div>

            {/* OCR Extracted Text Preview section */}
            {document.extracted_text && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-teal-600" />
                    Extracted Text &amp; Findings
                  </span>
                  <button
                    onClick={copyExtractedText}
                    className="text-xs text-teal-700 hover:text-teal-900 inline-flex items-center gap-1"
                  >
                    {copiedText ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-sage-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy text
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono max-h-36 overflow-y-auto scrollbar-thin bg-white p-2.5 rounded-lg border">
                  {document.extracted_text}
                </pre>
              </div>
            )}

            {/* Delete Confirmation Modal Overlay */}
            {confirmDelete && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Delete this medical document?</h4>
                    <p className="text-xs text-rose-700 mt-1">
                      This will permanently delete "{document.title}" from your encrypted storage vault and database. This action cannot be undone.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="btn btn-ghost text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="btn btn-danger text-xs"
                  >
                    {deleting ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
