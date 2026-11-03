DROP POLICY IF EXISTS customers_select ON public.customers;
CREATE POLICY customers_select ON public.customers
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR (team_id IS NOT NULL AND team_id IN (SELECT public.user_team_ids(auth.uid())))
);