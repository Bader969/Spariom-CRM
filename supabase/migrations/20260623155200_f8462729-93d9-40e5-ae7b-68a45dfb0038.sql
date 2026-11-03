
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.household_role AS ENUM (
  'hauptperson','partner','kind','elternteil','wg_mitbewohner','sonstiges'
);
CREATE TYPE public.relation_type AS ENUM (
  'ehepartner','elternteil','kind','geschwister','verwandt','wg','freund','empfehlung_quelle','sonstiges'
);
CREATE TYPE public.referral_status AS ENUM (
  'offen','zugesagt','ausgezahlt','storniert'
);

-- ============================================================
-- HOUSEHOLDS
-- ============================================================
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  street TEXT,
  house_no TEXT,
  postal_code TEXT,
  city TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.households TO authenticated;
GRANT ALL ON public.households TO service_role;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_households_updated BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- HOUSEHOLD MEMBERS
-- ============================================================
CREATE TABLE public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  role public.household_role NOT NULL DEFAULT 'sonstiges',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, customer_id)
);
CREATE INDEX household_members_customer_idx ON public.household_members(customer_id);
CREATE UNIQUE INDEX household_members_one_primary_idx
  ON public.household_members(household_id) WHERE is_primary;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_members TO authenticated;
GRANT ALL ON public.household_members TO service_role;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CUSTOMER RELATIONS (symmetrisch)
-- ============================================================
CREATE TABLE public.customer_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  related_customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  relation_type public.relation_type NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (customer_id <> related_customer_id),
  UNIQUE (customer_id, related_customer_id, relation_type)
);
CREATE INDEX customer_relations_customer_idx ON public.customer_relations(customer_id);
CREATE INDEX customer_relations_related_idx ON public.customer_relations(related_customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_relations TO authenticated;
GRANT ALL ON public.customer_relations TO service_role;
ALTER TABLE public.customer_relations ENABLE ROW LEVEL SECURITY;

-- Spiegelung: insert/update/delete A↔B
CREATE OR REPLACE FUNCTION public.mirror_customer_relation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inverse public.relation_type;
BEGIN
  -- Inverse Mapping
  v_inverse := CASE NEW.relation_type
    WHEN 'elternteil' THEN 'kind'::public.relation_type
    WHEN 'kind' THEN 'elternteil'::public.relation_type
    WHEN 'empfehlung_quelle' THEN 'empfehlung_quelle'::public.relation_type  -- bleibt; semantisch über referred_by
    ELSE NEW.relation_type
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.customer_relations (customer_id, related_customer_id, relation_type, notes, created_by)
    VALUES (NEW.related_customer_id, NEW.customer_id, v_inverse, NEW.notes, NEW.created_by)
    ON CONFLICT (customer_id, related_customer_id, relation_type) DO NOTHING;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.customer_relations
      WHERE customer_id = OLD.related_customer_id
        AND related_customer_id = OLD.customer_id
        AND relation_type = CASE OLD.relation_type
          WHEN 'elternteil' THEN 'kind'::public.relation_type
          WHEN 'kind' THEN 'elternteil'::public.relation_type
          ELSE OLD.relation_type
        END;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.mirror_customer_relation() FROM PUBLIC;

CREATE TRIGGER trg_customer_relations_mirror_ins
  AFTER INSERT ON public.customer_relations
  FOR EACH ROW EXECUTE FUNCTION public.mirror_customer_relation();
CREATE TRIGGER trg_customer_relations_mirror_del
  AFTER DELETE ON public.customer_relations
  FOR EACH ROW EXECUTE FUNCTION public.mirror_customer_relation();

-- ============================================================
-- CUSTOMERS: Empfehlung
-- ============================================================
ALTER TABLE public.customers
  ADD COLUMN referred_by_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN referral_bonus_amount NUMERIC(10,2),
  ADD COLUMN referral_status public.referral_status,
  ADD COLUMN referral_paid_at DATE,
  ADD COLUMN referral_notes TEXT;
CREATE INDEX customers_referred_by_idx ON public.customers(referred_by_customer_id);

-- ============================================================
-- CONTRACTS: Haushaltsbezug
-- ============================================================
ALTER TABLE public.contracts
  ADD COLUMN household_id UUID REFERENCES public.households(id) ON DELETE SET NULL;
CREATE INDEX contracts_household_idx ON public.contracts(household_id);

-- ============================================================
-- HELPER: kann Nutzer auf Haushalt zugreifen?
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_access_household(_user_id UUID, _household_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.household_members hm
      WHERE hm.household_id = _household_id
        AND public.can_access_customer(_user_id, hm.customer_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.households h
      WHERE h.id = _household_id AND h.created_by = _user_id
    )
$$;

-- ============================================================
-- POLICIES: households
-- ============================================================
CREATE POLICY households_select ON public.households
  FOR SELECT TO authenticated USING (true);
CREATE POLICY households_insert ON public.households
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY households_update ON public.households
  FOR UPDATE TO authenticated
  USING (public.can_access_household(auth.uid(), id))
  WITH CHECK (public.can_access_household(auth.uid(), id));
CREATE POLICY households_delete ON public.households
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid());

-- ============================================================
-- POLICIES: household_members
-- ============================================================
CREATE POLICY household_members_select ON public.household_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY household_members_insert ON public.household_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.can_access_customer(auth.uid(), customer_id)
  );
CREATE POLICY household_members_update ON public.household_members
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.can_access_customer(auth.uid(), customer_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.can_access_customer(auth.uid(), customer_id)
  );
CREATE POLICY household_members_delete ON public.household_members
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.can_access_customer(auth.uid(), customer_id)
  );

-- ============================================================
-- POLICIES: customer_relations
-- ============================================================
CREATE POLICY customer_relations_select ON public.customer_relations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY customer_relations_insert ON public.customer_relations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.can_access_customer(auth.uid(), customer_id)
    OR public.can_access_customer(auth.uid(), related_customer_id)
  );
CREATE POLICY customer_relations_update ON public.customer_relations
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.can_access_customer(auth.uid(), customer_id)
    OR public.can_access_customer(auth.uid(), related_customer_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.can_access_customer(auth.uid(), customer_id)
    OR public.can_access_customer(auth.uid(), related_customer_id)
  );
CREATE POLICY customer_relations_delete ON public.customer_relations
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.can_access_customer(auth.uid(), customer_id)
    OR public.can_access_customer(auth.uid(), related_customer_id)
  );
