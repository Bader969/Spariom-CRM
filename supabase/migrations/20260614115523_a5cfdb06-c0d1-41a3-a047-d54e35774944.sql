CREATE TYPE public.family_relation AS ENUM ('ehegatte', 'kind');

CREATE TABLE public.contract_family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  relation public.family_relation NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  birthdate date,
  versicherungsnummer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cfm_contract ON public.contract_family_members(contract_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_family_members TO authenticated;
GRANT ALL ON public.contract_family_members TO service_role;

ALTER TABLE public.contract_family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cfm_select" ON public.contract_family_members FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND public.can_access_customer(auth.uid(), c.customer_id)));

CREATE POLICY "cfm_insert" ON public.contract_family_members FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND public.can_access_customer(auth.uid(), c.customer_id)));

CREATE POLICY "cfm_update" ON public.contract_family_members FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND public.can_access_customer(auth.uid(), c.customer_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND public.can_access_customer(auth.uid(), c.customer_id)));

CREATE POLICY "cfm_delete" ON public.contract_family_members FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND public.can_access_customer(auth.uid(), c.customer_id)));

CREATE TRIGGER trg_cfm_updated BEFORE UPDATE ON public.contract_family_members
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();