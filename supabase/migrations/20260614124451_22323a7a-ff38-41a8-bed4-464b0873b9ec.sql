
-- Enums
CREATE TYPE public.kv_familienstand AS ENUM ('ledig','verheiratet','getrennt','geschieden','verwitwet');
CREATE TYPE public.kv_geschlecht AS ENUM ('m','w','d');
CREATE TYPE public.kv_verwandtschaft AS ENUM ('leiblich','stief','enkel','pflege');
CREATE TYPE public.kv_bisherig_art AS ENUM ('mitgliedschaft','familienversicherung','nicht_gesetzlich');

-- contract_kv_details
CREATE TABLE public.contract_kv_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL UNIQUE REFERENCES public.contracts(id) ON DELETE CASCADE,
  geschlecht public.kv_geschlecht,
  familienstand public.kv_familienstand,
  geburtsort text,
  geburtsland text,
  staatsangehoerigkeit text,
  kv_nummer text,
  vorherige_kasse text,
  vorherige_kasse_ende date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_kv_details TO authenticated;
GRANT ALL ON public.contract_kv_details TO service_role;

ALTER TABLE public.contract_kv_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kv_details_select" ON public.contract_kv_details FOR SELECT TO authenticated
USING (public.can_access_customer(auth.uid(), (SELECT customer_id FROM public.contracts WHERE id = contract_id)));
CREATE POLICY "kv_details_insert" ON public.contract_kv_details FOR INSERT TO authenticated
WITH CHECK (public.can_access_customer(auth.uid(), (SELECT customer_id FROM public.contracts WHERE id = contract_id)));
CREATE POLICY "kv_details_update" ON public.contract_kv_details FOR UPDATE TO authenticated
USING (public.can_access_customer(auth.uid(), (SELECT customer_id FROM public.contracts WHERE id = contract_id)))
WITH CHECK (public.can_access_customer(auth.uid(), (SELECT customer_id FROM public.contracts WHERE id = contract_id)));
CREATE POLICY "kv_details_delete" ON public.contract_kv_details FOR DELETE TO authenticated
USING (public.can_access_customer(auth.uid(), (SELECT customer_id FROM public.contracts WHERE id = contract_id)));

CREATE TRIGGER set_updated_at_contract_kv_details
BEFORE UPDATE ON public.contract_kv_details
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- contract_family_members extensions
ALTER TABLE public.contract_family_members
  ADD COLUMN geschlecht public.kv_geschlecht,
  ADD COLUMN verwandtschaft public.kv_verwandtschaft,
  ADD COLUMN geburtsname text,
  ADD COLUMN geburtsort text,
  ADD COLUMN geburtsland text,
  ADD COLUMN staatsangehoerigkeit text,
  ADD COLUMN bisherig_kasse text,
  ADD COLUMN bisherig_ende date,
  ADD COLUMN bisherig_art public.kv_bisherig_art,
  ADD COLUMN abweichende_anschrift text;
