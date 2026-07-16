
-- Migration: Add master_admin role and rename admin to owner
-- Prerequisite: 20260510141225_ba042c97-... (creates app_role enum)
--
-- 1. Adds 'master_admin' to app_role enum
-- 2. Renames 'admin' to 'owner' in app_role enum
-- 3. Creates has_management_role() helper (checks owner OR master_admin)
-- 4. Updates all RLS policies to use has_management_role()
-- 5. Adds owner_user_id column to units table

-- Step 1: Add master_admin to the enum (before owner for logical ordering)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'master_admin' BEFORE 'owner';

-- Step 2: Rename 'admin' to 'owner' (existing rows auto-update)
ALTER TYPE public.app_role RENAME VALUE 'admin' TO 'owner';

-- Step 3: Create has_management_role() helper
CREATE OR REPLACE FUNCTION public.has_management_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('owner', 'master_admin')
  )
$$;

-- Step 4: Update RLS policies to use has_management_role()

-- user_roles
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_management_role(auth.uid()));

CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_management_role(auth.uid()))
  WITH CHECK (public.has_management_role(auth.uid()));

-- profiles
DROP POLICY IF EXISTS "read own profile or admin" ON public.profiles;
DROP POLICY IF EXISTS "admin manage profiles" ON public.profiles;

CREATE POLICY "read own profile or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_management_role(auth.uid()));

CREATE POLICY "admin manage profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_management_role(auth.uid()))
  WITH CHECK (public.has_management_role(auth.uid()));

-- units
DROP POLICY IF EXISTS "admin all units" ON public.units;

CREATE POLICY "admin all units" ON public.units
  FOR ALL TO authenticated
  USING (public.has_management_role(auth.uid()))
  WITH CHECK (public.has_management_role(auth.uid()));

-- tenants
DROP POLICY IF EXISTS "admin all tenants" ON public.tenants;

CREATE POLICY "admin all tenants" ON public.tenants
  FOR ALL TO authenticated
  USING (public.has_management_role(auth.uid()))
  WITH CHECK (public.has_management_role(auth.uid()));

-- billing_cycles
DROP POLICY IF EXISTS "admin all billing" ON public.billing_cycles;

CREATE POLICY "admin all billing" ON public.billing_cycles
  FOR ALL TO authenticated
  USING (public.has_management_role(auth.uid()))
  WITH CHECK (public.has_management_role(auth.uid()));

-- payments
DROP POLICY IF EXISTS "admin all payments" ON public.payments;

CREATE POLICY "admin all payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.has_management_role(auth.uid()))
  WITH CHECK (public.has_management_role(auth.uid()));

-- waivers
DROP POLICY IF EXISTS "admin all waivers" ON public.waivers;

CREATE POLICY "admin all waivers" ON public.waivers
  FOR ALL TO authenticated
  USING (public.has_management_role(auth.uid()))
  WITH CHECK (public.has_management_role(auth.uid()));

-- queries
DROP POLICY IF EXISTS "admin all queries" ON public.queries;

CREATE POLICY "admin all queries" ON public.queries
  FOR ALL TO authenticated
  USING (public.has_management_role(auth.uid()))
  WITH CHECK (public.has_management_role(auth.uid()));

-- announcements
DROP POLICY IF EXISTS "admin write announcements" ON public.announcements;

CREATE POLICY "admin write announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (public.has_management_role(auth.uid()))
  WITH CHECK (public.has_management_role(auth.uid()));

-- storage
DROP POLICY IF EXISTS "admin read all proofs" ON storage.objects;

CREATE POLICY "admin read all proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.has_management_role(auth.uid()));

-- Step 5: Add owner_user_id column to units table
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Grant execute on new function
GRANT EXECUTE ON FUNCTION public.has_management_role(uuid) TO authenticated;
