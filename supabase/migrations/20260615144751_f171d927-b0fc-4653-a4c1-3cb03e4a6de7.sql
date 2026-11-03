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