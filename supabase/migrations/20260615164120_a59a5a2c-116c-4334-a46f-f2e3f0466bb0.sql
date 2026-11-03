DROP POLICY IF EXISTS customers_select ON public.customers;
CREATE POLICY customers_select ON public.customers
FOR SELECT TO authenticated
USING (true);