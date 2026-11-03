-- Extensions for high-performance fuzzy text search and GIN operations
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- 1. Contracts Table Indexes
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON public.contracts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_referenz_id ON public.contracts (referenz_id) WHERE referenz_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_customer_created ON public.contracts (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_type_status ON public.contracts (type, status);
CREATE INDEX IF NOT EXISTS idx_contracts_details_gin ON public.contracts USING gin (details);
CREATE INDEX IF NOT EXISTS idx_contracts_zaehlernummer ON public.contracts ((details->>'zaehlernummer')) WHERE details->>'zaehlernummer' IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_provider_trgm ON public.contracts USING gin (provider gin_trgm_ops);

-- 2. Customers Table Indexes
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers (last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_advisor_id ON public.customers (advisor_id) WHERE advisor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_full_name_trgm ON public.customers USING gin (((first_name || ' ' || last_name)) gin_trgm_ops);

-- 3. Tasks Table Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_customer_id ON public.tasks (customer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status ON public.tasks (assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks (due_date) WHERE due_date IS NOT NULL;
