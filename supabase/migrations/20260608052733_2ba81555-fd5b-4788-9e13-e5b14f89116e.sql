
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
