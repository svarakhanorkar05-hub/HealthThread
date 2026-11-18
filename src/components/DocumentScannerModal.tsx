import { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  RotateCw,
  CheckCircle,
  FileText,
  AlertCircle,
  X,
  FileCheck,
  Eye,
  Loader2,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { DOCUMENT_CATEGORIES, mapCategoryToRecordType } from '@/lib/constants';
import {
  performClientOCR,
  uploadMedicalDocument,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  type ExtractedDocumentData,
} from '@/lib/documents';
import type { DocumentCategory, DocumentRecord, HealthRecord } from '@/types/database';
import { supabase } from '@/lib/supabase';

interface DocumentScannerModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: (savedDoc: DocumentRecord) => void;
  initialHealthRecordId?: string | null;
}

type ScanMode = 'choose' | 'camera' | 'upload' | 'ocr-progress' | 'review';

export function DocumentScannerModal({
  open,
  onClose,
  userId,
  onSuccess,
  initialHealthRecordId,
}: DocumentScannerModalProps) {
  const [mode, setMode] = useState<ScanMode>('choose');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Camera stream & capture
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [rotationDegrees, setRotationDegrees] = useState(0);

  // Uploaded file
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // OCR state
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('');

  // Form review fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('Medical Reports');
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0]);
  const [extractedText, setExtractedText] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string>(initialHealthRecordId || '');
  const [createTimelineEvent, setCreateTimelineEvent] = useState(true);
  const [userRecords, setUserRecords] = useState<HealthRecord[]>([]);
  const [saving, setSaving] = useState(false);

  // Load user's health records for linking
  useEffect(() => {
    if (!open || !userId) return;
    supabase
      .from('health_records')
      .select('*')
      .eq('user_id', userId)
      .order('event_date', { ascending: false })
      .then(({ data }) => {
        if (data) setUserRecords(data as HealthRecord[]);
      });
  }, [open, userId]);

  // Clean up camera stream and object URLs on close
  useEffect(() => {
    if (!open) {
      stopCamera();
      resetState();
    }
  }, [open]);

  const resetState = () => {
    setMode('choose');
    setErrorMsg(null);
    setCapturedBlob(null);
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
      setCapturedPreviewUrl(null);
    }
    setUploadedFile(null);
    setRotationDegrees(0);
    setOcrProgress(0);
    setOcrStatusText('');
    setTitle('');
    setCategory('Medical Reports');
    setDocumentDate(new Date().toISOString().split('T')[0]);
    setExtractedText('');
    setSelectedRecordId(initialHealthRecordId || '');
    setCreateTimelineEvent(true);
    setSaving(false);
  };

  // Start Camera
  const startCamera = async (facing: 'environment' | 'user' = 'environment') => {
    setErrorMsg(null);
    setMode('camera');
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your current browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to access device camera';
      setErrorMsg(`${msg}. You can still upload files directly.`);
      setMode('choose');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const toggleCameraFacing = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  // Capture image from video stream
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();

    canvas.toBlob((blob) => {
      if (!blob) return;
      setCapturedBlob(blob);
      const url = URL.createObjectURL(blob);
      setCapturedPreviewUrl(url);
      processImageForReview(blob, 'Scanned_Document_' + new Date().toISOString().split('T')[0] + '.jpg');
    }, 'image/jpeg', 0.92);
  };

  // Rotate captured image 90 degrees
  const rotateCapturedImage = () => {
    if (!capturedBlob) return;
    const img = new Image();
    const url = URL.createObjectURL(capturedBlob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      canvas.toBlob((newBlob) => {
        if (!newBlob) return;
        setCapturedBlob(newBlob);
        if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);
        setCapturedPreviewUrl(URL.createObjectURL(newBlob));
        setRotationDegrees((r) => (r + 90) % 360);
      }, 'image/jpeg', 0.92);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // Handle uploaded file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setErrorMsg('Invalid file type. Please upload a PDF or image (JPEG, PNG, WebP).');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg('File exceeds 10 MB limit.');
      return;
    }

    setUploadedFile(file);
    const url = URL.createObjectURL(file);
    setCapturedPreviewUrl(url);

    if (file.type.startsWith('image/')) {
      processImageForReview(file, file.name);
    } else {
      // PDF file: directly go to review
      setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      setCategory('Medical Reports');
      setMode('review');
    }
  };

  // Process image with OCR and advance to review
  const processImageForReview = async (source: Blob | File, filename: string) => {
    setMode('ocr-progress');
    setOcrProgress(0.05);
    setOcrStatusText('Preparing image for analysis...');

    try {
      const extracted = await performClientOCR(source, (progress, status) => {
        setOcrProgress(progress);
        setOcrStatusText(status);
      });

      applyExtractedData(extracted, filename);
      setMode('review');
    } catch {
      setTitle(filename.replace(/\.[^/.]+$/, ''));
      setMode('review');
    }
  };

  const applyExtractedData = (data: ExtractedDocumentData, filename: string) => {
    setTitle(data.suggestedTitle || filename.replace(/\.[^/.]+$/, ''));
    setCategory(data.suggestedCategory || 'Medical Reports');
    if (data.suggestedDate) {
      setDocumentDate(data.suggestedDate);
    }
    setExtractedText(data.rawText || '');
  };

  // Save document
  const handleSaveDocument = async () => {
    if (!title.trim()) {
      setErrorMsg('Please enter a document title.');
      return;
    }

    const fileToSave = capturedBlob || uploadedFile;
    if (!fileToSave) {
      setErrorMsg('No file or scan available to save.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const originalName =
        uploadedFile?.name ||
        `scan_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;

      const mimeType = uploadedFile?.type || capturedBlob?.type || 'image/jpeg';

      let linkedRecordId = selectedRecordId;

      // Automatically create a corresponding Health Record entry on the timeline if requested
      if (!linkedRecordId && createTimelineEvent) {
        try {
          const { data: newRecord, error: recErr } = await supabase
            .from('health_records')
            .insert({
              user_id: userId,
              record_type: mapCategoryToRecordType(category),
              title: title.trim(),
              description: extractedText.trim()
                ? `Medical Report (${category}):\n${extractedText.trim().slice(0, 300)}`
                : `Uploaded ${category} document: ${title.trim()}`,
              event_date: documentDate || new Date().toISOString().split('T')[0],
            })
            .select()
            .single();

          if (!recErr && newRecord?.id) {
            linkedRecordId = newRecord.id;
          }
        } catch (linkErr) {
          console.warn('Failed to auto-create linked health record:', linkErr);
        }
      }

      const savedDoc = await uploadMedicalDocument({
        userId,
        file: fileToSave,
        title,
        category,
        documentDate: documentDate || null,
        originalFileName: originalName,
        mimeType,
        healthRecordId: linkedRecordId || null,
        extractedText: extractedText.trim() || null,
      });

      onSuccess(savedDoc);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        stopCamera();
        onClose();
      }}
      title="Scan or Upload Medical Document"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-rose-500 hover:text-rose-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* MODE 1: CHOOSE ACTION */}
        {mode === 'choose' && (
          <div className="py-4">
            <p className="text-sm text-slate-600 mb-6 text-center">
              Add medical reports, prescriptions, lab results, or certificates to your secure personal health vault.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/50 hover:bg-teal-50 hover:border-teal-400 transition-all group text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition-transform">
                  <Camera className="w-7 h-7" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Scan with Camera</h3>
                <p className="text-xs text-slate-500">
                  Use device camera with instant OCR text recognition
                </p>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-400 transition-all group text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-slate-700 text-white flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Upload File</h3>
                <p className="text-xs text-slate-500">
                  PDF, JPG, PNG or WebP up to 10 MB
                </p>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="mt-6 p-3.5 rounded-xl bg-cream-100 border border-sage-100 text-xs text-slate-600 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-teal-700 shrink-0" />
              <span>
                All documents are stored in encrypted private storage, protected by Supabase Row-Level Security, and accessible only by you.
              </span>
            </div>
          </div>
        )}

        {/* MODE 2: CAMERA CAPTURE */}
        {mode === 'camera' && (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />

              <div className="absolute inset-4 border-2 border-dashed border-white/60 pointer-events-none rounded-xl flex items-center justify-center">
                <span className="bg-black/60 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm">
                  Align document within frame
                </span>
              </div>

              {/* Flip camera control */}
              <button
                type="button"
                onClick={toggleCameraFacing}
                title="Switch Camera"
                className="absolute top-3 right-3 p-2.5 rounded-full bg-black/50 text-white hover:bg-black/80 transition-all backdrop-blur-sm"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setMode('choose');
                }}
                className="btn btn-ghost"
              >
                Back
              </button>

              <button
                type="button"
                onClick={captureSnapshot}
                className="btn btn-primary px-6 py-3 font-semibold shadow-elevated"
              >
                <Camera className="w-5 h-5" />
                Capture Document
              </button>
            </div>
          </div>
        )}

        {/* MODE 3: OCR PROCESSING */}
        {mode === 'ocr-progress' && (
          <div className="py-12 px-4 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center animate-pulse">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">Analyzing Medical Document</h3>
              <p className="text-sm text-slate-500 mt-1">{ocrStatusText || 'Extracting text and medical fields...'}</p>
            </div>

            <div className="max-w-xs mx-auto">
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-teal-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(ocrProgress * 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">{Math.round(ocrProgress * 100)}% complete</p>
            </div>
          </div>
        )}

        {/* MODE 4: REVIEW & EDIT */}
        {mode === 'review' && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin">
            {/* Preview Banner */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {uploadedFile?.type === 'application/pdf' ? (
                  <FileText className="w-8 h-8 text-rose-600 shrink-0" />
                ) : capturedPreviewUrl ? (
                  <img
                    src={capturedPreviewUrl}
                    alt="Preview"
                    className="w-12 h-12 object-cover rounded-lg border shrink-0"
                  />
                ) : (
                  <FileText className="w-8 h-8 text-teal-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {uploadedFile?.name || 'Camera Scan Capture'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {capturedBlob
                      ? `${(capturedBlob.size / 1024).toFixed(0)} KB (JPG)`
                      : uploadedFile
                      ? `${(uploadedFile.size / 1024).toFixed(0)} KB (${uploadedFile.type.split('/')[1]?.toUpperCase()})`
                      : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {capturedBlob && (
                  <button
                    type="button"
                    onClick={rotateCapturedImage}
                    title="Rotate 90 degrees"
                    className="btn btn-ghost px-2.5 py-1.5 text-xs"
                  >
                    <RotateCw className="w-4 h-4" />
                    Rotate
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    resetState();
                  }}
                  className="btn btn-ghost px-2.5 py-1.5 text-xs text-slate-500"
                >
                  Retake
                </button>
              </div>
            </div>

            {/* Document Details Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="label">
                  Document Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Complete Blood Count (CBC) Report"
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as DocumentCategory)}
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
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  className="input"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label">Link to Health Record (Optional)</label>
                <select
                  value={selectedRecordId}
                  onChange={(e) => setSelectedRecordId(e.target.value)}
                  className="input"
                >
                  <option value="">-- No specific health event linked --</option>
                  {userRecords.map((rec) => (
                    <option key={rec.id} value={rec.id}>
                      {rec.event_date} — {rec.title} ({rec.record_type.replace('_', ' ')})
                    </option>
                  ))}
                </select>
                {!selectedRecordId && (
                  <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs font-medium text-slate-700 bg-teal-50/70 p-2.5 rounded-lg border border-teal-100">
                    <input
                      type="checkbox"
                      checked={createTimelineEvent}
                      onChange={(e) => setCreateTimelineEvent(e.target.checked)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span>Also create an event on my Health Timeline for this document</span>
                  </label>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  {selectedRecordId
                    ? 'This document will be attached to the selected health record.'
                    : 'This document will be stored in your Documents vault and displayed on your Health Timeline.'}
                </p>
              </div>

              {/* Extracted OCR Text Box */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">Extracted OCR Text</label>
                  <span className="text-xs text-slate-400">Review &amp; edit text</span>
                </div>
                <textarea
                  rows={4}
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                  placeholder="Extracted text from the document will appear here for review and searchability..."
                  className="input font-mono text-xs"
                />
              </div>
            </div>

            {/* Medical Disclaimer */}
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Verification Notice:</strong> OCR text is automatically detected to assist with organization and search. Please verify extracted findings and consult your healthcare provider for clinical interpretation.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDocument}
                disabled={saving || !title.trim()}
                className="btn btn-primary"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading &amp; Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Save to Health Records
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
