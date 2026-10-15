/*
# HealthThread Storage Bucket

Creates a private storage bucket for health document uploads (lab results, prescriptions, imaging, reports).
Users can only access files within their own user_id folder.
*/

-- Create private storage bucket for health documents
INSERT INTO storage.buckets (id, name, public)
VALUES (
  'health-documents',
  'health-documents',
  false
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]
WHERE id = 'health-documents';

-- Policy: users can upload to their own folder
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
CREATE POLICY "Users can upload own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'health-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: users can read their own documents
DROP POLICY IF EXISTS "Users can read own documents" ON storage.objects;
CREATE POLICY "Users can read own documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'health-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: users can delete their own documents
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
CREATE POLICY "Users can delete own documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'health-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: users can update their own documents
DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
CREATE POLICY "Users can update own documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'health-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'health-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
