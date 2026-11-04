import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Client } = pg;
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("Missing DATABASE_URL in .env");
  process.exit(1);
}

const client = new Client({ connectionString: dbUrl });
await client.connect();

console.log("🚀 Setting up Task Automation schema, triggers & default rules...");

const sql = `
-- 1. Enums for Task Automation & Priority
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
    CREATE TYPE public.task_priority AS ENUM ('hoch', 'mittel', 'niedrig');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_trigger_event') THEN
    CREATE TYPE public.task_trigger_event AS ENUM ('contract_created', 'contract_activated', 'contract_cancelled');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_assignee_mode') THEN
    CREATE TYPE public.task_assignee_mode AS ENUM ('contract_creator', 'customer_advisor', 'specific_user');
  END IF;
END $$;

-- 2. Table: public.task_automation_rules
CREATE TABLE IF NOT EXISTS public.task_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_type public.contract_type NOT NULL,
  trigger_event public.task_trigger_event NOT NULL DEFAULT 'contract_created',
  title_template TEXT NOT NULL,
  description_template TEXT,
  due_days_offset INTEGER NOT NULL DEFAULT 2,
  priority public.task_priority NOT NULL DEFAULT 'mittel',
  assignee_mode public.task_assignee_mode NOT NULL DEFAULT 'contract_creator',
  specific_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_automation_rules TO authenticated;
GRANT ALL ON public.task_automation_rules TO service_role;
ALTER TABLE public.task_automation_rules ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_task_automation_rules_updated ON public.task_automation_rules;
CREATE TRIGGER trg_task_automation_rules_updated
  BEFORE UPDATE ON public.task_automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "task_automation_rules_select_all" ON public.task_automation_rules;
CREATE POLICY "task_automation_rules_select_all"
  ON public.task_automation_rules
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "task_automation_rules_admin_write" ON public.task_automation_rules;
CREATE POLICY "task_automation_rules_admin_write"
  ON public.task_automation_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Extend public.tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS priority public.task_priority NOT NULL DEFAULT 'mittel',
  ADD COLUMN IF NOT EXISTS is_automated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS automation_rule_id UUID REFERENCES public.task_automation_rules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_contract_id ON public.tasks(contract_id);

-- 4. Helper function for contract_type German label inside trigger
CREATE OR REPLACE FUNCTION public.fn_contract_type_label(_t public.contract_type)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _t
    WHEN 'energie_strom' THEN 'Energie – Strom'
    WHEN 'energie_gas' THEN 'Energie – Gas'
    WHEN 'gkv' THEN 'GKV'
    WHEN 'pkv' THEN 'PKV'
    WHEN 'telekommunikation' THEN 'Telekommunikation'
    WHEN 'kfz' THEN 'KFZ-Versicherung'
    ELSE _t::text
  END;
$$;

-- 5. Trigger Function: Automatically generate tasks from active rules when contracts are inserted or change status
CREATE OR REPLACE FUNCTION public.fn_auto_create_contract_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_name TEXT := 'Kunde';
  v_customer_advisor UUID := NULL;
  v_provider TEXT := COALESCE(NULLIF(TRIM(NEW.provider), ''), 'Anbieter');
  v_sparte TEXT := public.fn_contract_type_label(NEW.type);
  v_referenz TEXT := COALESCE(NULLIF(TRIM(NEW.referenz_id), ''), '—');
  v_rule RECORD;
  v_title TEXT;
  v_desc TEXT;
  v_assignee UUID;
  v_due DATE;
BEGIN
  -- Fetch customer name & advisor
  SELECT
    TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')),
    assigned_to
  INTO v_customer_name, v_customer_advisor
  FROM public.customers
  WHERE id = NEW.customer_id;

  IF v_customer_name IS NULL OR v_customer_name = '' THEN
    v_customer_name := 'Kunde';
  END IF;

  FOR v_rule IN
    SELECT *
    FROM public.task_automation_rules
    WHERE active = true
      AND contract_type = NEW.type
      AND (
        (TG_OP = 'INSERT' AND trigger_event = 'contract_created')
        OR (TG_OP = 'INSERT' AND NEW.status = 'aktiv' AND trigger_event = 'contract_activated')
        OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'aktiv' AND trigger_event = 'contract_activated')
        OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'gekuendigt_wartet_neuabschluss' AND trigger_event = 'contract_cancelled')
      )
    ORDER BY sort_order ASC, created_at ASC
  LOOP
    -- Resolve placeholders
    v_title := v_rule.title_template;
    v_title := REPLACE(v_title, '{kunde}', v_customer_name);
    v_title := REPLACE(v_title, '{anbieter}', v_provider);
    v_title := REPLACE(v_title, '{sparte}', v_sparte);
    v_title := REPLACE(v_title, '{referenz}', v_referenz);

    v_desc := v_rule.description_template;
    IF v_desc IS NOT NULL THEN
      v_desc := REPLACE(v_desc, '{kunde}', v_customer_name);
      v_desc := REPLACE(v_desc, '{anbieter}', v_provider);
      v_desc := REPLACE(v_desc, '{sparte}', v_sparte);
      v_desc := REPLACE(v_desc, '{referenz}', v_referenz);
    END IF;

    -- Resolve assignee
    IF v_rule.assignee_mode = 'specific_user' AND v_rule.specific_user_id IS NOT NULL THEN
      v_assignee := v_rule.specific_user_id;
    ELSIF v_rule.assignee_mode = 'customer_advisor' THEN
      v_assignee := COALESCE(v_customer_advisor, NEW.created_by);
    ELSE
      v_assignee := COALESCE(NEW.created_by, v_customer_advisor);
    END IF;

    -- Compute due date
    v_due := CURRENT_DATE + COALESCE(v_rule.due_days_offset, 2);

    -- Prevent duplicate creation for same contract + rule
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE contract_id = NEW.id AND automation_rule_id = v_rule.id
    ) THEN
      INSERT INTO public.tasks (
        customer_id,
        contract_id,
        assigned_to,
        title,
        description,
        due_date,
        status,
        priority,
        is_automated,
        automation_rule_id,
        created_by
      ) VALUES (
        NEW.customer_id,
        NEW.id,
        v_assignee,
        v_title,
        v_desc,
        v_due,
        'offen',
        v_rule.priority,
        true,
        v_rule.id,
        COALESCE(NEW.created_by, v_assignee)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contracts_auto_tasks ON public.contracts;
CREATE TRIGGER trg_contracts_auto_tasks
  AFTER INSERT OR UPDATE OF status ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_create_contract_tasks();
`;

await client.query(sql);
console.log("✅ Schema & Trigger trg_contracts_auto_tasks created.");

// 6. Seed 11 default rules if empty
const existingRules = await client.query("SELECT count(*) FROM public.task_automation_rules");
if (Number(existingRules.rows[0].count) === 0) {
  const defaultRules = [
    // Energie – Strom
    {
      contract_type: "energie_strom",
      trigger_event: "contract_created",
      title_template: "Zählerstand & Zählernummer anfordern ({kunde})",
      description_template: "Für den Stromvertrag bei {anbieter} (Ref: {referenz}) Zählerstand und Zählernummer vom Kunden einholen und im Portal nachtragen.",
      due_days_offset: 2,
      priority: "hoch",
      assignee_mode: "contract_creator",
      sort_order: 1,
    },
    {
      contract_type: "energie_strom",
      trigger_event: "contract_created",
      title_template: "Kündigungsbestätigung & Lieferbeginn prüfen ({anbieter})",
      description_template: "Prüfen, ob der Vorversorger die Kündigung für {kunde} bestätigt hat und der Wechseltermin zu {anbieter} steht.",
      due_days_offset: 7,
      priority: "mittel",
      assignee_mode: "contract_creator",
      sort_order: 2,
    },
    // Energie – Gas
    {
      contract_type: "energie_gas",
      trigger_event: "contract_created",
      title_template: "Gaszählerstand & MaLo-ID dokumentieren ({kunde})",
      description_template: "Zählerstand des Gaszählers für {anbieter} anfordern und in der Kundenakte hinterlegen.",
      due_days_offset: 2,
      priority: "hoch",
      assignee_mode: "contract_creator",
      sort_order: 1,
    },
    {
      contract_type: "energie_gas",
      trigger_event: "contract_activated",
      title_template: "Abschlagsplan von {anbieter} mit Kunden abgleichen",
      description_template: "Nach Aktivierung des Gasvertrags den monatlichen Abschlag mit {kunde} abstimmen.",
      due_days_offset: 10,
      priority: "niedrig",
      assignee_mode: "customer_advisor",
      sort_order: 2,
    },
    // GKV
    {
      contract_type: "gkv",
      trigger_event: "contract_created",
      title_template: "GKV-Mitgliedsbescheinigung ({anbieter}) an Arbeitgeber senden",
      description_template: "Mitgliedsbescheinigung der {anbieter} für {kunde} einholen und an den Arbeitgeber bzw. Kunden weiterleiten.",
      due_days_offset: 3,
      priority: "hoch",
      assignee_mode: "contract_creator",
      sort_order: 1,
    },
    {
      contract_type: "gkv",
      trigger_event: "contract_created",
      title_template: "Familienfragebogen & Lichtbild für Versichertenkarte prüfen ({kunde})",
      description_template: "Prüfen, ob Lichtbild für die eGK und ggf. der Familienfragebogen bei {anbieter} vollständig vorliegen.",
      due_days_offset: 5,
      priority: "mittel",
      assignee_mode: "contract_creator",
      sort_order: 2,
    },
    // PKV
    {
      contract_type: "pkv",
      trigger_event: "contract_created",
      title_template: "Gesundheitsprüfung & Vorab-Unterlagen einreichen ({kunde})",
      description_template: "Vollständige Gesundheitsangaben und Arztberichte für den PKV-Antrag bei {anbieter} prüfen und einreichen.",
      due_days_offset: 1,
      priority: "hoch",
      assignee_mode: "contract_creator",
      sort_order: 1,
    },
    {
      contract_type: "pkv",
      trigger_event: "contract_created",
      title_template: "SEPA-Mandat & Beratungsprotokoll archivieren ({anbieter})",
      description_template: "Unterschriebenes Beratungsprotokoll und SEPA-Lastschriftmandat für {kunde} im Dokumentenbereich ablegen.",
      due_days_offset: 3,
      priority: "hoch",
      assignee_mode: "contract_creator",
      sort_order: 2,
    },
    // Telekommunikation
    {
      contract_type: "telekommunikation",
      trigger_event: "contract_created",
      title_template: "Rufnummernmitnahme (Portierung) & Schalttermin bestätigen ({anbieter})",
      description_template: "Portierungsdatum und Techniker-/Schalttermin für {kunde} bei {anbieter} kontrollieren.",
      due_days_offset: 3,
      priority: "mittel",
      assignee_mode: "contract_creator",
      sort_order: 1,
    },
    // KFZ
    {
      contract_type: "kfz",
      trigger_event: "contract_created",
      title_template: "eVB-Nummer übermitteln & aktuellen KM-Stand erfassen ({kunde})",
      description_template: "eVB-Nummer von {anbieter} an {kunde} senden und aktuellen Tachostand dokumentieren.",
      due_days_offset: 1,
      priority: "hoch",
      assignee_mode: "contract_creator",
      sort_order: 1,
    },
    {
      contract_type: "kfz",
      trigger_event: "contract_activated",
      title_template: "SF-Klassen-Übernahme vom Vorversicherer prüfen ({anbieter})",
      description_template: "Kontrollieren, ob die Schadenfreiheitsklasse (SF-Klasse) für {kunde} korrekt von {anbieter} übernommen wurde.",
      due_days_offset: 14,
      priority: "mittel",
      assignee_mode: "customer_advisor",
      sort_order: 2,
    },
  ];

  for (const r of defaultRules) {
    await client.query(
      `INSERT INTO public.task_automation_rules (
        contract_type, trigger_event, title_template, description_template,
        due_days_offset, priority, assignee_mode, active, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)`,
      [
        r.contract_type,
        r.trigger_event,
        r.title_template,
        r.description_template,
        r.due_days_offset,
        r.priority,
        r.assignee_mode,
        r.sort_order,
      ]
    );
  }
  console.log("✅ Seeded 11 default task automation rules across all 6 contract types.");
}

// 7. Enrich existing demo tasks with realistic priorities & automated flags + today/tomorrow dates for rich filtering
await client.query(`
  WITH numbered AS (
    SELECT id, row_number() OVER (ORDER BY created_at) AS rn
    FROM public.tasks
  )
  UPDATE public.tasks t
  SET
    priority = CASE
      WHEN n.rn % 3 = 1 THEN 'hoch'::public.task_priority
      WHEN n.rn % 3 = 2 THEN 'mittel'::public.task_priority
      ELSE 'niedrig'::public.task_priority
    END,
    is_automated = CASE WHEN t.contract_id IS NOT NULL AND n.rn % 3 != 0 THEN true ELSE false END,
    due_date = CASE
      WHEN n.rn IN (1, 2, 3) THEN CURRENT_DATE
      WHEN n.rn IN (4, 5, 6) THEN CURRENT_DATE + 1
      WHEN n.rn IN (7, 8, 9) THEN CURRENT_DATE + 2
      WHEN n.rn IN (10, 11, 12, 13) THEN CURRENT_DATE + 5
      ELSE t.due_date
    END
  FROM numbered n
  WHERE t.id = n.id;
`);

console.log("✅ Enriched existing demo tasks with priorities, automation flags, and today/tomorrow due dates.");

await client.end();
console.log("🎉 Task Automation database setup complete!");
