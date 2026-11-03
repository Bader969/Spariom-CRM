
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_team_leader(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_team_ids(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.led_team_ids(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_customer(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_contract_status_change() FROM anon, public, authenticated;
