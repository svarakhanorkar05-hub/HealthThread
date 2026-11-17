import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeFileName, parseMedicalTextHeuristics } from '../src/lib/document-heuristics.ts';

test('sanitizeFileName removes dangerous characters', () => {
  assert.equal(sanitizeFileName('report #1 (final) [2026].pdf'), 'report__1__final___2026_.pdf');
  assert.equal(sanitizeFileName('normal_file-123.jpg'), 'normal_file-123.jpg');
});

test('parseMedicalTextHeuristics categorizes lab reports and extracts dates', () => {
  const ocrText = `
    CITY DIAGNOSTIC CENTER
    Dr. Robert Smith
    Patient: John Doe
    Date: 2026-10-14
    COMPLETE BLOOD COUNT (CBC) LAB REPORT
    Hemoglobin: 14.2 g/dL (normal)
    Platelet count: 250,000 /uL
  `;

  const parsed = parseMedicalTextHeuristics(ocrText);
  assert.equal(parsed.suggestedCategory, 'Laboratory Reports');
  assert.equal(parsed.suggestedDate, '2026-10-14');
  assert.ok(parsed.suggestedProvider?.includes('Robert Smith'));
  assert.ok(parsed.detectedFindings.length > 0);
});

test('parseMedicalTextHeuristics categorizes prescriptions', () => {
  const rxText = `
    Rx Prescription
    Dr. Jane Miller
    Date: 2026-09-01
    Amoxicillin 500mg capsule
    Take daily for 7 days
  `;

  const parsed = parseMedicalTextHeuristics(rxText);
  assert.equal(parsed.suggestedCategory, 'Prescriptions');
  assert.equal(parsed.suggestedDate, '2026-09-01');
});
