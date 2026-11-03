
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
