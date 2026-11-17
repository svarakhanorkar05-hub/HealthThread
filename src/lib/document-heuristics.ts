import type { DocumentCategory } from '../types/database.ts';

export interface ExtractedDocumentData {
  rawText: string;
  suggestedTitle: string;
  suggestedCategory: DocumentCategory;
  suggestedDate: string | null;
  suggestedProvider: string | null;
  suggestedPatient: string | null;
  detectedFindings: string[];
}

/**
 * Sanitizes a filename for storage safety
 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Heuristics to parse common medical report elements from OCR text
 */
export function parseMedicalTextHeuristics(text: string): ExtractedDocumentData {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // Category heuristics
  let suggestedCategory: DocumentCategory = 'Scanned Documents';
  if (
    lower.includes('lab') ||
    lower.includes('pathology') ||
    lower.includes('blood test') ||
    lower.includes('hemoglobin') ||
    lower.includes('cbc') ||
    lower.includes('specimen')
  ) {
    suggestedCategory = 'Laboratory Reports';
  } else if (
    lower.includes('rx') ||
    lower.includes('prescription') ||
    lower.includes('dosage') ||
    lower.includes('take daily') ||
    lower.includes('capsule') ||
    lower.includes('tablet')
  ) {
    suggestedCategory = 'Prescriptions';
  } else if (
    lower.includes('vaccine') ||
    lower.includes('immunization') ||
    lower.includes('dose') ||
    lower.includes('vaccination')
  ) {
    suggestedCategory = 'Vaccination Records';
  } else if (
    lower.includes('discharge') ||
    lower.includes('admission') ||
    lower.includes('hospital')
  ) {
    suggestedCategory = 'Discharge Summaries';
  } else if (
    lower.includes('consultation') ||
    lower.includes('clinic') ||
    lower.includes('doctor') ||
    lower.includes('physician')
  ) {
    suggestedCategory = 'Doctor Consultation Records';
  } else if (
    lower.includes('report') ||
    lower.includes('diagnosis') ||
    lower.includes('examination')
  ) {
    suggestedCategory = 'Medical Reports';
  }

  // Date heuristics (looks for YYYY-MM-DD or DD/MM/YYYY)
  let suggestedDate: string | null = null;
  const isoMatch = clean.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    suggestedDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  } else {
    const dmyMatch = clean.match(/\b(0[1-9]|[12]\d|3[01])[-/.](0[1-9]|1[0-2])[-/.](20\d{2})\b/);
    if (dmyMatch) {
      suggestedDate = `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    }
  }

  // Doctor/Hospital Provider heuristics
  let suggestedProvider: string | null = null;
  const drMatch = clean.match(/(?:Dr\.|Doctor|Physician|Provider)\s*[:.]?\s*([A-Z][a-zA-Z\s.]+)/i);
  if (drMatch && drMatch[1]) {
    suggestedProvider = 'Dr. ' + drMatch[1].trim().split('\n')[0].replace(/[;,].*$/, '');
  } else {
    const hospMatch = clean.match(
      /(?:Hospital|Clinic|Healthcare|Laboratory|Pathology|Diagnostic Center)\s*[:.]?\s*([A-Za-z0-9\s.]+)/i
    );
    if (hospMatch && hospMatch[0]) {
      suggestedProvider = hospMatch[0].trim().split('\n')[0].substring(0, 40);
    }
  }

  // Patient heuristics
  let suggestedPatient: string | null = null;
  const patientMatch = clean.match(/(?:Patient(?:\s*Name)?|Name)\s*[:.]\s*([A-Z][a-zA-Z\s]+)/i);
  if (patientMatch && patientMatch[1]) {
    suggestedPatient = patientMatch[1].trim().split('\n')[0].replace(/[;,].*$/, '');
  }

  // Suggested title based on category and provider
  let suggestedTitle = `${suggestedCategory}`;
  if (suggestedProvider) {
    suggestedTitle = `${suggestedCategory} - ${suggestedProvider}`;
  } else if (suggestedDate) {
    suggestedTitle = `${suggestedCategory} (${suggestedDate})`;
  }

  // Extract lines that look like findings or lab values
  const lines = clean.split('\n').map((l) => l.trim()).filter((l) => l.length > 5);
  const detectedFindings = lines
    .filter((l) =>
      /(:|\b(?:normal|abnormal|high|low|positive|negative|mg\/dl|g\/dl|mmol\/l|iu\/l)\b)/i.test(l)
    )
    .slice(0, 8);

  return {
    rawText: clean,
    suggestedTitle,
    suggestedCategory,
    suggestedDate: suggestedDate || new Date().toISOString().split('T')[0],
    suggestedProvider,
    suggestedPatient,
    detectedFindings,
  };
}
