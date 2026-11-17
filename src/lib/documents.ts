import { supabase } from '@/lib/supabase';
import type { DocumentRecord, DocumentCategory } from '@/types/database';
import { createWorker } from 'tesseract.js';
import {
  sanitizeFileName,
  parseMedicalTextHeuristics,
  type ExtractedDocumentData,
} from './document-heuristics';

export { sanitizeFileName, parseMedicalTextHeuristics, type ExtractedDocumentData };

export const STORAGE_BUCKET = 'health-documents';
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

/**
 * Uploads a file to the user's private folder in Supabase Storage and records metadata
 */
export async function uploadMedicalDocument(params: {
  userId: string;
  file: File | Blob;
  title: string;
  category: DocumentCategory;
  documentDate?: string | null;
  originalFileName: string;
  mimeType: string;
  healthRecordId?: string | null;
  extractedText?: string | null;
}): Promise<DocumentRecord> {
  const {
    userId,
    file,
    title,
    category,
    documentDate,
    originalFileName,
    mimeType,
    healthRecordId,
    extractedText,
  } = params;

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds maximum allowed size of 10 MB.`);
  }

  const docId = crypto.randomUUID();
  const safeName = sanitizeFileName(originalFileName);
  const storagePath = `${userId}/${docId}_${safeName}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  // Insert into documents table
  const insertPayload = {
    id: docId,
    user_id: userId,
    title: title.trim(),
    category,
    document_type: mapCategoryToLegacyType(category),
    file_path: storagePath,
    file_size: file.size,
    mime_type: mimeType,
    original_filename: originalFileName,
    document_date: documentDate || null,
    health_record_id: healthRecordId || null,
    extracted_text: extractedText || null,
  };

  const { data, error: dbError } = await supabase
    .from('documents')
    .insert(insertPayload)
    .select()
    .single();

  if (dbError) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw new Error(`Failed to save document record: ${dbError.message}`);
  }

  return data as DocumentRecord;
}

/**
 * Maps new user-friendly DocumentCategory to legacy document_type column constraint
 */
function mapCategoryToLegacyType(
  category: DocumentCategory
): 'lab_result' | 'prescription' | 'imaging' | 'report' | 'other' {
  switch (category) {
    case 'Laboratory Reports':
      return 'lab_result';
    case 'Prescriptions':
      return 'prescription';
    case 'Medical Reports':
    case 'Discharge Summaries':
    case 'Doctor Consultation Records':
      return 'report';
    default:
      return 'other';
  }
}

/**
 * Generates an authenticated, short-lived signed URL to preview or download the file
 */
export async function getDocumentSignedUrl(
  filePath: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to retrieve document: ${error?.message || 'Unknown error'}`);
  }

  return data.signedUrl;
}

/**
 * Deletes a document from both Supabase Storage and the database
 */
export async function deleteDocument(doc: DocumentRecord): Promise<void> {
  if (doc.file_path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([doc.file_path]);
  }

  const { error } = await supabase.from('documents').delete().eq('id', doc.id);

  if (error) {
    throw new Error(`Failed to delete document record: ${error.message}`);
  }
}

/**
 * Run client-side OCR on an image file/blob with progress reporting
 */
export async function performClientOCR(
  imageSource: File | Blob | string,
  onProgress?: (progress: number, status: string) => void
): Promise<ExtractedDocumentData> {
  try {
    onProgress?.(0.1, 'Initializing OCR engine...');
    const worker = await createWorker('eng');

    onProgress?.(0.3, 'Analyzing document image...');
    const result = await worker.recognize(imageSource);
    const text = result.data.text || '';

    onProgress?.(0.9, 'Processing medical heuristics...');
    await worker.terminate();

    const extracted = parseMedicalTextHeuristics(text);
    onProgress?.(1.0, 'Done');
    return extracted;
  } catch (err) {
    console.warn('OCR processing error:', err);
    return {
      rawText: '',
      suggestedTitle: 'Scanned Medical Document',
      suggestedCategory: 'Scanned Documents',
      suggestedDate: new Date().toISOString().split('T')[0],
      suggestedProvider: null,
      suggestedPatient: null,
      detectedFindings: [],
    };
  }
}
