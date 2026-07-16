-- Migration: Add per-day billing period columns
-- Run this if you already created your database with the original schema.sql

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS pay_by_day INT NOT NULL DEFAULT 20;

ALTER TABLE public.billing_cycles
  ADD COLUMN IF NOT EXISTS period_start DATE,
  ADD COLUMN IF NOT EXISTS period_end DATE,
  ADD COLUMN IF NOT EXISTS days_billed INT,
  ADD COLUMN IF NOT EXISTS due_date DATE;

CREATE INDEX IF NOT EXISTS idx_billing_cycles_period_start ON public.billing_cycles(period_start);
