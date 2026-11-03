
DROP POLICY IF EXISTS contracts_select ON public.contracts;
CREATE POLICY contracts_select ON public.contracts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "View clarifications by access" ON public.clarifications;
CREATE POLICY "View clarifications by access" ON public.clarifications
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS notes_select ON public.customer_notes;
CREATE POLICY notes_select ON public.customer_notes
  FOR SELECT TO authenticated USING (true);
