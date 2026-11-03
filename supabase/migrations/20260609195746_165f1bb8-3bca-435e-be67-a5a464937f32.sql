
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS is_fremdvertrag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fremd_quelle text,
  ADD COLUMN IF NOT EXISTS iban text;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS advisor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS lead_source_detail text;

UPDATE public.customers SET recorded_by = created_by WHERE recorded_by IS NULL;
