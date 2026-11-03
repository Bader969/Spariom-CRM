
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
