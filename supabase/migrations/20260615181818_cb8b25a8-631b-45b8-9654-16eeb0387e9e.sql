
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
