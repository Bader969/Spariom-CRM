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