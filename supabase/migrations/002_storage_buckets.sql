-- Riciti: Supabase Storage Bucket Setup
-- Run this in your Supabase SQL Editor to create the storage bucket
-- for invoice images (logos, signatures)

-- Create the 'invoices' storage bucket with public read access
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  true,
  524288, -- 512KB max file size
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to all files in the bucket
CREATE POLICY "Public read access for invoices bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'invoices');

-- Allow service role (server-side) to upload files
CREATE POLICY "Service role upload to invoices bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'invoices'
    AND auth.role() = 'service_role'
  );

-- Allow service role to delete files (cleanup)
CREATE POLICY "Service role delete from invoices bucket"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'invoices'
    AND auth.role() = 'service_role'
  );
