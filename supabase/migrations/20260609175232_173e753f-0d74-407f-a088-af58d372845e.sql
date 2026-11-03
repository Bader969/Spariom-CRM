
-- 1) Tighten customer_notes update policy with can_access_customer check
DROP POLICY IF EXISTS notes_update_own ON public.customer_notes;
CREATE POLICY notes_update_own ON public.customer_notes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (author_id = auth.uid() AND public.can_access_customer(auth.uid(), customer_id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (author_id = auth.uid() AND public.can_access_customer(auth.uid(), customer_id))
  );

-- 2) Remove contracts from the realtime publication to prevent broadcast of row data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'contracts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.contracts';
  END IF;
END $$;

-- 3) Revoke EXECUTE on internal trigger functions from PUBLIC/authenticated
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_contract_status_change() FROM PUBLIC, anon, authenticated;
