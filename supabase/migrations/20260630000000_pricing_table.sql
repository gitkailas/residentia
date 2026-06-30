-- Migration: Add pricing table for owner-defined monthly rent per unit type
-- Prerequisite: 20260601000000_master_admin_role.sql

-- Step 1: Create pricing table
CREATE TABLE IF NOT EXISTS public.pricing (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_type text NOT NULL,
    monthly_rent numeric(10, 2) NOT NULL DEFAULT 0,
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(unit_type, created_by)
);

-- Step 2: Enable RLS
ALTER TABLE public.pricing ENABLE ROW LEVEL SECURITY;

-- Step 3: RLS — owners and master_admins can manage pricing
CREATE POLICY "management manage pricing" ON public.pricing
  FOR ALL TO authenticated
  USING (public.has_management_role(auth.uid()))
  WITH CHECK (public.has_management_role(auth.uid()));

-- Step 4: Index for lookups by owner
CREATE INDEX IF NOT EXISTS idx_pricing_created_by ON public.pricing(created_by);
