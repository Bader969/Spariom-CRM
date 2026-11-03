
CREATE TYPE public.clarification_status AS ENUM ('offen', 'wartend', 'erledigt');
CREATE TYPE public.clarification_category AS ENUM ('zaehlerstand', 'km_stand', 'familienversicherung', 'unterlagen', 'bankdaten', 'widerruf', 'sonstiges');

CREATE TABLE public.clarifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category public.clarification_category NOT NULL DEFAULT 'sonstiges',
  status public.clarification_status NOT NULL DEFAULT 'offen',
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  due_date date,
  assigned_to uuid,
  created_by uuid,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clarifications_status_due ON public.clarifications(status, due_date);
CREATE INDEX idx_clarifications_customer ON public.clarifications(customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clarifications TO authenticated;
GRANT ALL ON public.clarifications TO service_role;

ALTER TABLE public.clarifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View clarifications by access"
  ON public.clarifications FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'haupt_vertriebler')
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR (customer_id IS NOT NULL AND public.can_access_customer(auth.uid(), customer_id))
  );

CREATE POLICY "Authenticated can create clarifications"
  ON public.clarifications FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Only leads can update clarifications"
  ON public.clarifications FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'haupt_vertriebler')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'haupt_vertriebler')
  );

CREATE POLICY "Admins delete clarifications"
  ON public.clarifications FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_clarifications_updated_at
  BEFORE UPDATE ON public.clarifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
