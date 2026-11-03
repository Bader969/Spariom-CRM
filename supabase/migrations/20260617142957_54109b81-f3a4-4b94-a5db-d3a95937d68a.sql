DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE public.payment_method AS ENUM ('selbstzahler', 'lastschrift');
  END IF;
END $$;

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS payment_method public.payment_method;