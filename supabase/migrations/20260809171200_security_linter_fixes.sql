-- Migration: Fix Supabase Database Linter Warnings (Security Hardening)

-- 1. Tighten RLS policies for public.contract_documents
DROP POLICY IF EXISTS "Authenticated users can insert contract_documents" ON public.contract_documents;
CREATE POLICY "Authenticated users can insert contract_documents"
  ON public.contract_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND (uploaded_by IS NULL OR uploaded_by = auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can delete contract_documents" ON public.contract_documents;
CREATE POLICY "Authenticated users can delete contract_documents"
  ON public.contract_documents FOR DELETE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
  );

-- 2. Revoke direct RPC execution on internal trigger functions from anon & authenticated
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_customer_relation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contracts_auto_convert_lead() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.profiles_block_active_self_update() FROM PUBLIC, anon, authenticated;

-- 3. Switch has_role to SECURITY INVOKER
ALTER FUNCTION public.has_role(_user_id uuid, _role public.app_role) SECURITY INVOKER;

-- 4. Revoke direct RPC execution on internal RLS helper functions from authenticated & PUBLIC
REVOKE EXECUTE ON FUNCTION public.can_access_customer(uuid, uuid) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_household(uuid, uuid) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_team_leader(uuid, uuid) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.led_team_ids(uuid) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_team_ids(uuid) FROM authenticated, PUBLIC;
