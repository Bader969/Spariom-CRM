-- Migration: Create contract_documents table and private contract-documents bucket
CREATE TABLE IF NOT EXISTS public.contract_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_documents_contract_id ON public.contract_documents(contract_id);

ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can select contract_documents" ON public.contract_documents;
CREATE POLICY "Authenticated users can select contract_documents"
  ON public.contract_documents FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert contract_documents" ON public.contract_documents;
CREATE POLICY "Authenticated users can insert contract_documents"
  ON public.contract_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete contract_documents" ON public.contract_documents;
CREATE POLICY "Authenticated users can delete contract_documents"
  ON public.contract_documents FOR DELETE
  TO authenticated
  USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-documents',
  'contract-documents',
  false,
  26214400,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

DROP POLICY IF EXISTS "Authenticated users can read contract-documents" ON storage.objects;
CREATE POLICY "Authenticated users can read contract-documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'contract-documents');

DROP POLICY IF EXISTS "Authenticated users can upload contract-documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload contract-documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'contract-documents');

DROP POLICY IF EXISTS "Authenticated users can delete contract-documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete contract-documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'contract-documents');
