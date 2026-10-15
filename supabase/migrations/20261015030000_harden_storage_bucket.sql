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
