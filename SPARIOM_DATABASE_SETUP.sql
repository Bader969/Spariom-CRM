
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'haupt_vertriebler', 'mitarbeiter');
CREATE TYPE public.contract_type AS ENUM ('energie_strom', 'energie_gas', 'gkv', 'pkv', 'telekommunikation', 'kfz');
CREATE TYPE public.contract_status AS ENUM ('aktiv', 'in_pruefung', 'gekuendigt_wartet_neuabschluss', 'abgelaufen', 'storniert');
CREATE TYPE public.task_status AS ENUM ('offen', 'erledigt');
CREATE TYPE public.note_type AS ENUM ('notiz', 'anruf', 'system');

-- =========================================================
-- UTILITY: updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- USER ROLES
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'haupt_vertriebler' THEN 2 ELSE 3 END
  LIMIT 1
$$;

-- =========================================================
-- TEAMS
-- =========================================================
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  leader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_members (
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Helpers
CREATE OR REPLACE FUNCTION public.is_team_leader(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND leader_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.user_team_ids(_user_id UUID)
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.teams WHERE leader_id = _user_id
  UNION
  SELECT team_id FROM public.team_members WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.led_team_ids(_user_id UUID)
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.teams WHERE leader_id = _user_id
$$;

-- =========================================================
-- CUSTOMERS
-- =========================================================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salutation TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  street TEXT,
  zip TEXT,
  city TEXT,
  birthdate DATE,
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.can_access_customer(_user_id UUID, _customer_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = _customer_id
        AND (
          c.assigned_to = _user_id
          OR c.created_by = _user_id
          OR (c.team_id IS NOT NULL AND c.team_id IN (SELECT public.led_team_ids(_user_id)))
        )
    )
$$;

-- =========================================================
-- CONTRACTS
-- =========================================================
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  type public.contract_type NOT NULL,
  status public.contract_status NOT NULL DEFAULT 'in_pruefung',
  provider TEXT,
  vermittlungsportal TEXT,
  referenz_id TEXT,
  start_date DATE,
  end_date DATE,
  monthly_amount NUMERIC(10,2),
  commission NUMERIC(10,2),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  kanban_position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_contracts_customer ON public.contracts(customer_id);
CREATE INDEX idx_contracts_status ON public.contracts(status);
CREATE INDEX idx_contracts_end_date ON public.contracts(end_date);

-- =========================================================
-- CUSTOMER NOTES
-- =========================================================
CREATE TABLE public.customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  note_type public.note_type NOT NULL DEFAULT 'notiz',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_notes TO authenticated;
GRANT ALL ON public.customer_notes TO service_role;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notes_customer ON public.customer_notes(customer_id, created_at DESC);

-- =========================================================
-- TASKS
-- =========================================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status public.task_status NOT NULL DEFAULT 'offen',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- POLICIES
-- =========================================================
-- profiles: jeder authentifizierte sieht alle profile (intern); nur admin schreibt fremde
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- user_roles: jeder authentifizierte kann sehen (für UI); nur admin ändern
CREATE POLICY "roles_select_all" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_admin_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- teams
CREATE POLICY "teams_select_all" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "teams_admin_write" ON public.teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR leader_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR leader_id = auth.uid());

-- team_members
CREATE POLICY "team_members_select_all" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_members_manage" ON public.team_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_team_leader(auth.uid(), team_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_team_leader(auth.uid(), team_id));

-- customers
CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR (team_id IS NOT NULL AND team_id IN (SELECT public.led_team_ids(auth.uid())))
);
CREATE POLICY "customers_insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid()
);
CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR assigned_to = auth.uid()
  OR (team_id IS NOT NULL AND team_id IN (SELECT public.led_team_ids(auth.uid())))
) WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR assigned_to = auth.uid()
  OR (team_id IS NOT NULL AND team_id IN (SELECT public.led_team_ids(auth.uid())))
);
CREATE POLICY "customers_delete" ON public.customers FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
);

-- contracts: visibility erbt über kunde
CREATE POLICY "contracts_select" ON public.contracts FOR SELECT TO authenticated USING (
  public.can_access_customer(auth.uid(), customer_id)
);
CREATE POLICY "contracts_insert" ON public.contracts FOR INSERT TO authenticated WITH CHECK (
  public.can_access_customer(auth.uid(), customer_id)
);
CREATE POLICY "contracts_update" ON public.contracts FOR UPDATE TO authenticated
  USING (public.can_access_customer(auth.uid(), customer_id))
  WITH CHECK (public.can_access_customer(auth.uid(), customer_id));
CREATE POLICY "contracts_delete" ON public.contracts FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.can_access_customer(auth.uid(), customer_id)
);

-- notes
CREATE POLICY "notes_select" ON public.customer_notes FOR SELECT TO authenticated USING (
  public.can_access_customer(auth.uid(), customer_id)
);
CREATE POLICY "notes_insert" ON public.customer_notes FOR INSERT TO authenticated WITH CHECK (
  public.can_access_customer(auth.uid(), customer_id) AND author_id = auth.uid()
);
CREATE POLICY "notes_update_own" ON public.customer_notes FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "notes_delete_own" ON public.customer_notes FOR DELETE TO authenticated USING (
  author_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
);

-- tasks
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR (customer_id IS NOT NULL AND public.can_access_customer(auth.uid(), customer_id))
);
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid()
);
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR assigned_to = auth.uid() OR created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR created_by = auth.uid()
);

-- =========================================================
-- TRIGGER: Auto profile + first-user-as-admin
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT;
  v_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );

  SELECT COUNT(*) INTO v_count FROM public.user_roles;
  IF v_count = 0 THEN
    v_role := 'admin';
  ELSE
    v_role := 'mitarbeiter';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- TRIGGER: Log status changes to timeline
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_contract_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.customer_notes (customer_id, author_id, content, note_type)
    VALUES (NEW.customer_id, auth.uid(),
      'Vertragsstatus geändert: ' || OLD.status::text || ' → ' || NEW.status::text,
      'system');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_contract_status_log
AFTER UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.log_contract_status_change();

-- =========================================================
-- REALTIME für contracts (Kanban Live-Updates)
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts;


REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_team_leader(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_team_ids(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.led_team_ids(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_customer(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_contract_status_change() FROM anon, public, authenticated;


-- 1) Tighten customer_notes update policy with can_access_customer check
DROP POLICY IF EXISTS notes_update_own ON public.customer_notes;
CREATE POLICY notes_update_own ON public.customer_notes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (author_id = auth.uid() AND public.can_access_customer(auth.uid(), customer_id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (author_id = auth.uid() AND public.can_access_customer(auth.uid(), customer_id))
  );

-- 2) Remove contracts from the realtime publication to prevent broadcast of row data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'contracts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.contracts';
  END IF;
END $$;

-- 3) Revoke EXECUTE on internal trigger functions from PUBLIC/authenticated
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_contract_status_change() FROM PUBLIC, anon, authenticated;


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


DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role)
     OR assigned_to = auth.uid()
     OR created_by = auth.uid())
    AND (customer_id IS NULL OR can_access_customer(auth.uid(), customer_id))
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role)
     OR assigned_to = auth.uid()
     OR created_by = auth.uid())
    AND (customer_id IS NULL OR can_access_customer(auth.uid(), customer_id))
  );

DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks
  FOR DELETE TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR created_by = auth.uid())
    AND (customer_id IS NULL OR can_access_customer(auth.uid(), customer_id))
  );


DROP POLICY IF EXISTS "Authenticated can create clarifications" ON public.clarifications;
CREATE POLICY "Authenticated can create clarifications" ON public.clarifications
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND (customer_id IS NULL OR public.can_access_customer(auth.uid(), customer_id))
  );

DROP POLICY IF EXISTS "Only leads can update clarifications" ON public.clarifications;
CREATE POLICY "Only leads can update clarifications" ON public.clarifications
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.has_role(auth.uid(), 'haupt_vertriebler'::app_role)
        AND (customer_id IS NULL OR public.can_access_customer(auth.uid(), customer_id)))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.has_role(auth.uid(), 'haupt_vertriebler'::app_role)
        AND (customer_id IS NULL OR public.can_access_customer(auth.uid(), customer_id)))
  );

DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND (customer_id IS NULL OR public.can_access_customer(auth.uid(), customer_id))
  );

DROP POLICY IF EXISTS "notes_delete_own" ON public.customer_notes;
CREATE POLICY "notes_delete_own" ON public.customer_notes
  FOR DELETE USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (author_id = auth.uid() AND public.can_access_customer(auth.uid(), customer_id))
  );


DROP POLICY IF EXISTS "Authenticated can create clarifications" ON public.clarifications;
CREATE POLICY "Authenticated can create clarifications" ON public.clarifications
  FOR INSERT TO authenticated
  WITH CHECK ((created_by = auth.uid()) AND ((customer_id IS NULL) OR can_access_customer(auth.uid(), customer_id)));

DROP POLICY IF EXISTS "Only leads can update clarifications" ON public.clarifications;
CREATE POLICY "Only leads can update clarifications" ON public.clarifications
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (has_role(auth.uid(), 'haupt_vertriebler'::app_role) AND ((customer_id IS NULL) OR can_access_customer(auth.uid(), customer_id))))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR (has_role(auth.uid(), 'haupt_vertriebler'::app_role) AND ((customer_id IS NULL) OR can_access_customer(auth.uid(), customer_id))));

DROP POLICY IF EXISTS "notes_delete_own" ON public.customer_notes;
CREATE POLICY "notes_delete_own" ON public.customer_notes
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR ((author_id = auth.uid()) AND can_access_customer(auth.uid(), customer_id)));

DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK ((created_by = auth.uid()) AND ((customer_id IS NULL) OR can_access_customer(auth.uid(), customer_id)));


-- 1. Email Allowlist
CREATE TABLE public.auth_email_allowlist (
  email TEXT PRIMARY KEY,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_email_allowlist TO authenticated;
GRANT ALL ON public.auth_email_allowlist TO service_role;

ALTER TABLE public.auth_email_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage allowlist" ON public.auth_email_allowlist
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Login attempts (rate limit)
CREATE TABLE public.auth_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  email TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_attempts_ip_time ON public.auth_login_attempts(ip, attempted_at DESC);

GRANT ALL ON public.auth_login_attempts TO service_role;
-- Intentionally NO grants to anon/authenticated: only server functions read/write.

ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read attempts" ON public.auth_login_attempts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Seed initial allowlist entry
INSERT INTO public.auth_email_allowlist (email, note)
VALUES ('bader969@gmx.de', 'Initialer Admin')
ON CONFLICT (email) DO NOTHING;

-- 4. Update handle_new_user to enforce allowlist
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INT;
  v_role public.app_role;
BEGIN
  -- Enforce email allowlist
  IF NOT EXISTS (
    SELECT 1 FROM public.auth_email_allowlist
    WHERE lower(email) = lower(NEW.email)
  ) THEN
    RAISE EXCEPTION 'Diese E-Mail-Adresse ist nicht für die Registrierung freigegeben.'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );

  SELECT COUNT(*) INTO v_count FROM public.user_roles;
  IF v_count = 0 THEN
    v_role := 'admin';
  ELSE
    v_role := 'mitarbeiter';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END; $function$;

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
-- 1) Tasks: bei verknüpftem Kunden auch Kundenzugriff verlangen
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR created_by = auth.uid()
  OR (
    (assigned_to = auth.uid())
    AND (customer_id IS NULL OR can_access_customer(auth.uid(), customer_id))
  )
  OR (customer_id IS NOT NULL AND can_access_customer(auth.uid(), customer_id))
);

-- 2) can_access_customer: auch reguläre Team-Mitglieder zulassen
CREATE OR REPLACE FUNCTION public.can_access_customer(_user_id uuid, _customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = _customer_id
        AND (
          c.assigned_to = _user_id
          OR c.created_by = _user_id
          OR (c.team_id IS NOT NULL AND c.team_id IN (SELECT public.user_team_ids(_user_id)))
        )
    )
$function$;

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

DROP POLICY IF EXISTS customers_select ON public.customers;
CREATE POLICY customers_select ON public.customers
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR (team_id IS NOT NULL AND team_id IN (SELECT public.user_team_ids(auth.uid())))
);
-- Enum customer_status
DO $$ BEGIN
  CREATE TYPE public.customer_status AS ENUM ('interessent', 'kunde');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Spalte hinzufügen
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS status public.customer_status NOT NULL DEFAULT 'kunde';

-- Vor-/Nachname optional
ALTER TABLE public.customers ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE public.customers ALTER COLUMN last_name DROP NOT NULL;

-- Index für die Listenansicht
CREATE INDEX IF NOT EXISTS customers_status_assigned_idx
  ON public.customers (status, assigned_to);

-- Trigger: mind. ein Kontaktmerkmal verlangen
CREATE OR REPLACE FUNCTION public.customers_require_min_contact()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NULLIF(trim(NEW.phone), ''), NULL) IS NULL
     AND COALESCE(NULLIF(trim(NEW.email), ''), NULL) IS NULL
     AND COALESCE(NULLIF(trim(NEW.first_name), ''), NULL) IS NULL
     AND COALESCE(NULLIF(trim(NEW.last_name), ''), NULL) IS NULL THEN
    RAISE EXCEPTION 'Mindestens eines der Felder Telefon, E-Mail, Vorname oder Nachname muss angegeben werden.'
      USING ERRCODE = 'check_violation';
  END IF;
  -- Für vollwertige Kunden weiterhin Vor- und Nachname verlangen
  IF NEW.status = 'kunde' THEN
    IF COALESCE(NULLIF(trim(NEW.first_name), ''), NULL) IS NULL
       OR COALESCE(NULLIF(trim(NEW.last_name), ''), NULL) IS NULL THEN
      RAISE EXCEPTION 'Vorname und Nachname sind für Kunden Pflicht.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS customers_require_min_contact_trg ON public.customers;
CREATE TRIGGER customers_require_min_contact_trg
  BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.customers_require_min_contact();

-- Trigger: Interessent -> Kunde, sobald erster Vertrag angelegt wird
CREATE OR REPLACE FUNCTION public.contracts_auto_convert_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.customer_status;
BEGIN
  SELECT status INTO v_status FROM public.customers WHERE id = NEW.customer_id;
  IF v_status = 'interessent' THEN
    UPDATE public.customers SET status = 'kunde', updated_at = now() WHERE id = NEW.customer_id;
    INSERT INTO public.customer_notes (customer_id, author_id, content, note_type)
    VALUES (NEW.customer_id, auth.uid(),
      'Interessent zu Kunde konvertiert (erster Vertrag angelegt).',
      'system');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS contracts_auto_convert_lead_trg ON public.contracts;
CREATE TRIGGER contracts_auto_convert_lead_trg
  AFTER INSERT ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.contracts_auto_convert_lead();
DROP POLICY IF EXISTS customers_select ON public.customers;
CREATE POLICY customers_select ON public.customers
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS contracts_select ON public.contracts;
CREATE POLICY contracts_select ON public.contracts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "View clarifications by access" ON public.clarifications;
CREATE POLICY "View clarifications by access" ON public.clarifications
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS notes_select ON public.customer_notes;
CREATE POLICY notes_select ON public.customer_notes
  FOR SELECT TO authenticated USING (true);


-- 1) Prevent non-admin users from toggling profiles.active on their own row
CREATE OR REPLACE FUNCTION public.profiles_block_active_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.active IS DISTINCT FROM OLD.active
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen den Aktiv-Status ändern.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_active_self_update ON public.profiles;
CREATE TRIGGER profiles_block_active_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_block_active_self_update();

REVOKE ALL ON FUNCTION public.profiles_block_active_self_update() FROM PUBLIC, anon;

-- 2) Allow the customer creator to also update the record
DROP POLICY IF EXISTS customers_update ON public.customers;
CREATE POLICY customers_update ON public.customers
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR (team_id IS NOT NULL AND public.is_team_leader(auth.uid(), team_id))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR (team_id IS NOT NULL AND public.is_team_leader(auth.uid(), team_id))
);

-- 3) Lock down trigger helper from anon/public execute
REVOKE ALL ON FUNCTION public.contracts_auto_convert_lead() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_contract_status_change() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;


DROP POLICY IF EXISTS "Authenticated can create clarifications" ON public.clarifications;
CREATE POLICY "Authenticated can create clarifications"
  ON public.clarifications FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE public.payment_method AS ENUM ('selbstzahler', 'lastschrift');
  END IF;
END $$;

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS payment_method public.payment_method;
CREATE OR REPLACE FUNCTION public.profiles_block_active_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.active IS DISTINCT FROM OLD.active
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen den Aktiv-Status ändern.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$function$;

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

REVOKE EXECUTE ON FUNCTION public.mirror_customer_relation() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_household(uuid, uuid) FROM PUBLIC, anon;
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

-- Migration: Fix Supabase Database Linter Warnings (Security Hardening)

-- 1. Tighten RLS policies for public.contract_documents
DROP POLICY IF EXISTS "Authenticated users can insert contract_documents" ON public.contract_documents;
CREATE POLICY "Authenticated users can insert contract_documents"
  ON public.contract_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND (uploaded_by IS NULL OR uploaded_by = auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can delete contract_documents" ON public.contract_documents;
CREATE POLICY "Authenticated users can delete contract_documents"
  ON public.contract_documents FOR DELETE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
  );

-- 2. Revoke direct RPC execution on internal trigger functions from anon & authenticated
-- (rls_auto_enable not present on fresh instance)
REVOKE EXECUTE ON FUNCTION public.mirror_customer_relation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contracts_auto_convert_lead() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.profiles_block_active_self_update() FROM PUBLIC, anon, authenticated;

-- 3. Switch has_role to SECURITY INVOKER
ALTER FUNCTION public.has_role(_user_id uuid, _role public.app_role) SECURITY INVOKER;

-- 4. Revoke direct RPC execution on internal RLS helper functions from authenticated & PUBLIC
REVOKE EXECUTE ON FUNCTION public.can_access_customer(uuid, uuid) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_household(uuid, uuid) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_team_leader(uuid, uuid) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.led_team_ids(uuid) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_team_ids(uuid) FROM authenticated, PUBLIC;

-- Migration: Add DISG personality_type column to public.customers
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS personality_type TEXT CHECK (personality_type IN ('dominant', 'initiativ', 'gewissenhaft', 'stetig'));

-- Extensions for high-performance fuzzy text search and GIN operations
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- 1. Contracts Table Indexes
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON public.contracts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_referenz_id ON public.contracts (referenz_id) WHERE referenz_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_customer_created ON public.contracts (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_type_status ON public.contracts (type, status);
CREATE INDEX IF NOT EXISTS idx_contracts_details_gin ON public.contracts USING gin (details);
CREATE INDEX IF NOT EXISTS idx_contracts_zaehlernummer ON public.contracts ((details->>'zaehlernummer')) WHERE details->>'zaehlernummer' IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_provider_trgm ON public.contracts USING gin (provider gin_trgm_ops);

-- 2. Customers Table Indexes
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers (last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_advisor_id ON public.customers (advisor_id) WHERE advisor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_full_name_trgm ON public.customers USING gin (((first_name || ' ' || last_name)) gin_trgm_ops);

-- 3. Tasks Table Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_customer_id ON public.tasks (customer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status ON public.tasks (assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks (due_date) WHERE due_date IS NOT NULL;


-- =========================================================
-- ADDITIONAL COLUMNS & CUSTOMER DOCUMENTS (SPARIOM COMPLETE)
-- =========================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE TABLE IF NOT EXISTS public.customer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  hidrive_path TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'allgemein',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_documents_customer_id ON public.customer_documents(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_documents TO authenticated;
GRANT ALL ON public.customer_documents TO service_role;
ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_documents_select ON public.customer_documents;
CREATE POLICY customer_documents_select ON public.customer_documents FOR SELECT TO authenticated USING (public.can_access_customer(auth.uid(), customer_id));
DROP POLICY IF EXISTS customer_documents_insert ON public.customer_documents;
CREATE POLICY customer_documents_insert ON public.customer_documents FOR INSERT TO authenticated WITH CHECK (public.can_access_customer(auth.uid(), customer_id));
DROP POLICY IF EXISTS customer_documents_update ON public.customer_documents;
CREATE POLICY customer_documents_update ON public.customer_documents FOR UPDATE TO authenticated USING (public.can_access_customer(auth.uid(), customer_id)) WITH CHECK (public.can_access_customer(auth.uid(), customer_id));
DROP POLICY IF EXISTS customer_documents_delete ON public.customer_documents;
CREATE POLICY customer_documents_delete ON public.customer_documents FOR DELETE TO authenticated USING (public.can_access_customer(auth.uid(), customer_id));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('customer_documents', 'customer_documents', false, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800, allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

DROP POLICY IF EXISTS "Authenticated users can read customer_documents" ON storage.objects;
CREATE POLICY "Authenticated users can read customer_documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'customer_documents');
DROP POLICY IF EXISTS "Authenticated users can upload customer_documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload customer_documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'customer_documents');
DROP POLICY IF EXISTS "Authenticated users can delete customer_documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete customer_documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'customer_documents');
