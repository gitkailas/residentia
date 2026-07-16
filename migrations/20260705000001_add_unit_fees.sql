-- Add per-unit maintenance and garbage fee columns
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS maintenance_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS garbage_fee DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Backfill: set default fees from the type-based rates
UPDATE public.units SET maintenance_fee = 1200, garbage_fee = 100 WHERE type = '1BHK' AND maintenance_fee = 0;
UPDATE public.units SET maintenance_fee = 1550, garbage_fee = 100 WHERE type = '2BHK' AND maintenance_fee = 0;
UPDATE public.units SET maintenance_fee = 1900, garbage_fee = 100 WHERE type = '3BHK' AND maintenance_fee = 0;
UPDATE public.units SET maintenance_fee = 2250, garbage_fee = 100 WHERE type = '4BHK' AND maintenance_fee = 0;
UPDATE public.units SET maintenance_fee = 2600, garbage_fee = 100 WHERE type = '5BHK' AND maintenance_fee = 0;
UPDATE public.units SET maintenance_fee = 2950, garbage_fee = 100 WHERE type = '6BHK' AND maintenance_fee = 0;
