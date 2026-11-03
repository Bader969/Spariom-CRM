
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
