-- Add rent_due column to billing_cycles for rented units
ALTER TABLE public.billing_cycles
  ADD COLUMN IF NOT EXISTS rent_due DECIMAL(10,2) NOT NULL DEFAULT 0;
