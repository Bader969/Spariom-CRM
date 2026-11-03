
DROP POLICY IF EXISTS "Authenticated can create clarifications" ON public.clarifications;
CREATE POLICY "Authenticated can create clarifications"
  ON public.clarifications FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
