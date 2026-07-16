-- Migration: Add missing columns to align local schema with Supabase migration
-- Run this if you already created your database with the original schema.sql

-- Units: add columns used by the frontend
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS registration_date DATE,
  ADD COLUMN IF NOT EXISTS key_handover_date DATE,
  ADD COLUMN IF NOT EXISTS waiver_start_date DATE,
  ALTER COLUMN floor SET NOT NULL,
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'unsold',
  ALTER COLUMN billing_enabled SET DEFAULT false;

-- Billing cycles: add maintenance/garbage breakdown columns
ALTER TABLE public.billing_cycles
  ADD COLUMN IF NOT EXISTS maintenance_due DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS garbage_due DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ALTER COLUMN is_waiver_period SET NOT NULL,
  ALTER COLUMN is_waiver_period SET DEFAULT false;

-- Payments: align with frontend columns
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS amount_maintenance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_garbage DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reference_no VARCHAR(255),
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS recorded_by VARCHAR(255),
  ALTER COLUMN balance SET NOT NULL,
  ALTER COLUMN balance SET DEFAULT 0,
  ALTER COLUMN payment_date TYPE DATE USING payment_date::DATE,
  ALTER COLUMN payment_date SET NOT NULL,
  ALTER COLUMN payment_date SET DEFAULT CURRENT_DATE;

-- Queries: rename message → description, align defaults
ALTER TABLE public.queries
  ADD COLUMN IF NOT EXISTS description TEXT;
UPDATE public.queries SET description = message WHERE description IS NULL;
ALTER TABLE public.queries
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'Open',
  ALTER COLUMN status SET NOT NULL;

-- Waivers: replace old columns with new schema
ALTER TABLE public.waivers
  ADD COLUMN IF NOT EXISTS waiver_type VARCHAR(50) NOT NULL DEFAULT 'Manual',
  ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS waiver_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
UPDATE public.waivers SET status = 'Pending Approval' WHERE status NOT IN ('Pending Approval','Approved','Rejected');
ALTER TABLE public.waivers
  ALTER COLUMN reason SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'Pending Approval',
  ALTER COLUMN status SET NOT NULL;
