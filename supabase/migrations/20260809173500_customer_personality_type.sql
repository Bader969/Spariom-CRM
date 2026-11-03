-- Migration: Add DISG personality_type column to public.customers
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS personality_type TEXT CHECK (personality_type IN ('dominant', 'initiativ', 'gewissenhaft', 'stetig'));
