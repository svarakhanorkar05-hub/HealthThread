import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FolderOpen,
  Search,
  Filter,
  Plus,
  Camera,
  FileText,
  Calendar,
  Eye,
  Trash2,
  Download,
  Clock,
  ArrowUpDown,
  Layers,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ToastContainer, useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeletons';
import { EmptyState } from '@/components/EmptyState';
import { DocumentScannerModal } from '@/components/DocumentScannerModal';
import { DocumentViewerModal } from '@/components/DocumentViewerModal';
import { formatDate } from '@/lib/utils';
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_COLORS } from '@/lib/constants';
import type { DocumentRecord, DocumentCategory } from '@/types/database';
import { supabase } from '@/lib/supabase';

export function DocumentsPage() {
  const { user } = useAuth();
  const { toasts, success, error, dismiss } = useToast();

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'title'>('date-desc');

  // Modals
  const [scannerOpen, setScannerOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<DocumentRecord | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setDocuments((data || []) as DocumentRecord[]);
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [user, error]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Filter & Sort
  const filteredDocuments = useMemo(() => {
    return documents
      .filter((doc) => {
        // Category filter
        if (selectedCategory !== 'All' && doc.category !== selectedCategory) {
          return false;
        }

        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = doc.title?.toLowerCase().includes(q);
          const matchesOriginal = doc.original_filename?.toLowerCase().includes(q);
          const matchesText = doc.extracted_text?.toLowerCase().includes(q);
          const matchesCategory = doc.category?.toLowerCase().includes(q);
          return matchesTitle || matchesOriginal || matchesText || matchesCategory;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        const dateA = new Date(a.document_date || a.uploaded_at).getTime();
        const dateB = new Date(b.document_date || b.uploaded_at).getTime();
        return sortBy === 'date-desc' ? dateB - dateA : dateA - dateB;
      });
  }, [documents, selectedCategory, searchQuery, sortBy]);

  const handleDocumentSaved = (newDoc: DocumentRecord) => {
    setDocuments((prev) => [newDoc, ...prev]);
    success('Document uploaded and saved successfully!');
  };

  const handleDocumentDeleted = (deletedId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== deletedId));
    success('Document deleted.');
  };

  const handleDocumentUpdated = (updatedDoc: DocumentRecord) => {
    setDocuments((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)));
    setViewingDoc(updatedDoc);
    success('Document details updated.');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Medical Documents
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Scan and securely store your lab reports, prescriptions, and medical records.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="btn btn-primary shadow-sm inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <Camera className="w-4 h-4" />
          <span>Scan / Upload Document</span>
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, findings, keywords, or original file..."
              className="input pl-10"
            />
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="input py-2.5 text-xs font-medium cursor-pointer"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="title">Title (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin text-xs">
          <span className="text-slate-400 font-medium mr-1 shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>

          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all ${
              selectedCategory === 'All'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Documents ({documents.length})
          </button>

          {DOCUMENT_CATEGORIES.map((cat) => {
            const count = documents.filter((d) => d.category === cat).length;
            if (count === 0 && selectedCategory !== cat) return null;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Document Grid / List */}
      {loading ? (
        <SkeletonList count={4} />
      ) : filteredDocuments.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="w-7 h-7" />}
          title={
            searchQuery || selectedCategory !== 'All'
              ? 'No matching documents found'
              : 'No medical documents stored yet'
          }
          description={
            searchQuery || selectedCategory !== 'All'
              ? 'Try adjusting your search terms or filter selection.'
              : 'Scan documents with your phone camera or upload PDFs and images of your medical records.'
          }
          action={
            <button
              onClick={() => {
                if (searchQuery || selectedCategory !== 'All') {
                  setSearchQuery('');
                  setSelectedCategory('All');
                } else {
                  setScannerOpen(true);
                }
              }}
              className="btn btn-primary"
            >
              {searchQuery || selectedCategory !== 'All' ? 'Clear Filters' : 'Scan Your First Document'}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => {
            const isPdf =
              doc.mime_type === 'application/pdf' ||
              doc.original_filename?.toLowerCase().endsWith('.pdf');

            return (
              <div
                key={doc.id}
                onClick={() => setViewingDoc(doc)}
                className="card card-hover p-4 cursor-pointer flex flex-col justify-between transition-all group"
              >
                <div>
                  {/* Top Bar with category badge & date */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`badge border text-[11px] ${
                        DOCUMENT_CATEGORY_COLORS[doc.category] || 'bg-slate-50 text-slate-700'
                      }`}
                    >
                      {doc.category || 'Other'}
                    </span>

                    <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                      <Calendar className="w-3 h-3" />
                      {doc.document_date ? formatDate(doc.document_date) : formatDate(doc.uploaded_at)}
                    </span>
                  </div>

                  {/* Title and Icon */}
                  <div className="flex items-start gap-3 mb-2">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isPdf
                          ? 'bg-rose-50 text-rose-600 border border-rose-100'
                          : 'bg-teal-50 text-teal-700 border border-teal-100'
                      }`}
                    >
                      <FileText className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900 text-sm line-clamp-1 group-hover:text-teal-700 transition-colors">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {doc.original_filename || 'Scanned Document'}
                      </p>
                    </div>
                  </div>

                  {/* Extracted preview text snippet */}
                  {doc.extracted_text && (
                    <p className="text-xs text-slate-500 line-clamp-2 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      {doc.extracted_text}
                    </p>
                  )}
                </div>

                {/* Bottom details */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs text-slate-400">
                  <span>
                    {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : ''}
                  </span>

                  <span className="text-teal-700 font-medium inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <Eye className="w-3.5 h-3.5" /> View Document
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Scanner & Upload Modal */}
      {user && (
        <DocumentScannerModal
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          userId={user.id}
          onSuccess={handleDocumentSaved}
        />
      )}

      {/* Viewer & Preview Modal */}
      <DocumentViewerModal
        document={viewingDoc}
        open={Boolean(viewingDoc)}
        onClose={() => setViewingDoc(null)}
        onDeleted={handleDocumentDeleted}
        onUpdated={handleDocumentUpdated}
      />
    </div>
  );
}
