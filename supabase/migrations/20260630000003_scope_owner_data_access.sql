
-- Migration: Scope owner data access to their own units
-- Prerequisite: 20260601000000_master_admin_role.sql
--
-- Problem: The "admin all" policies let any owner see ALL rows across all units.
-- This means owner A can see tenants, billing, payments of owner B.
--
-- Fix: Scope owners to only rows related to their own units.
-- master_admin retains full visibility across all units.

-- Step 1: Create helper to check if user is master_admin
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'master_admin'
  )
$$;

-- ============ UNITS ============
DROP POLICY IF EXISTS "admin all units" ON public.units;

CREATE POLICY "admin all units" ON public.units
  FOR ALL TO authenticated
  USING (
    public.is_master_admin(auth.uid())
    OR (public.has_management_role(auth.uid()) AND owner_user_id = auth.uid())
  )
  WITH CHECK (
    public.is_master_admin(auth.uid())
    OR (public.has_management_role(auth.uid()) AND owner_user_id = auth.uid())
  );

-- ============ TENANTS ============
DROP POLICY IF EXISTS "admin all tenants" ON public.tenants;

CREATE POLICY "admin all tenants" ON public.tenants
  FOR ALL TO authenticated
  USING (
    public.is_master_admin(auth.uid())
    OR (public.has_management_role(auth.uid()) AND unit_id IN (SELECT id FROM public.units WHERE owner_user_id = auth.uid()))
  )
  WITH CHECK (
    public.is_master_admin(auth.uid())
    OR (public.has_management_role(auth.uid()) AND unit_id IN (SELECT id FROM public.units WHERE owner_user_id = auth.uid()))
  );

-- ============ PROFILES ============
-- owners can see/manage profiles of residents in their own units
DROP POLICY IF EXISTS "read own profile or admin" ON public.profiles;
DROP POLICY IF EXISTS "admin manage profiles" ON public.profiles;

CREATE POLICY "read own profile or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_master_admin(auth.uid())
    OR (public.has_management_role(auth.uid()) AND unit_id IN (SELECT id FROM public.units WHERE owner_user_id = auth.uid()))
  );

CREATE POLICY "admin manage profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (
    public.is_master_admin(auth.uid())
    OR (public.has_management_role(auth.uid()) AND unit_id IN (SELECT id FROM public.units WHERE owner_user_id = auth.uid()))
  )
  WITH CHECK (
    public.is_master_admin(auth.uid())
    OR (public.has_management_role(auth.uid()) AND unit_id IN (SELECT id FROM public.units WHERE owner_user_id = auth.uid()))
  );

-- ============ BILLING CYCLES ============
DROP POLICY IF EXISTS "admin all billing" ON public.billing_cycles;

CREATE POLICY "admin all billing" ON public.billing_cycles
  FOR ALL TO authenticated
  USING (
    public.is_master_admin(auth.uid())
    OR (public.has_management_role(auth.uid()) AND unit_id IN (SELECT id FROM public.units WHERE owner_user_id = auth.uid()))
  )
  WITH CHECK (
    public.is_master_admin(auth.uid())
    OR (public.has_management_role(auth.uid()) AND unit_id IN (SELECT id FROM public.units WHERE owner_user_id = auth.uid()))
  );

-- ============ PAYMENTS ============
DROP POLICY IF EXISTS "admin all payments" ON public.payments;

CREATE POLICY "admin all payments" ON public.payments
  FOR ALL TO authenticated
  USING (
    public.is_master_admin(auth.uid())
    OR (public.has_management_role(auth.uid()) AND unit_id IN (SELECT id FROM public.units WHERE owner_user_id = auth.uid()))
  )
  WITH CHECK (
    public.is_master_admin(auth.uid())
    OR (public.has_management_role(auth.uid()) AND unit_id IN (SELECT id FROM public.units WHERE owner_user_id = auth.uid()))
  );

-- ============ WAIVERS ============
DROP POLICY IF EXISTS "admin all waivers" ON public.waivers;

CREATE POLICY "admin all waivers" ON public.waivers
  FOR ALL TO authenticated
  USING (
    public.is_master_admin(auth.uid())
    OR (public.has_management_role(auth.uid()) AND unit_id IN (SELECT id FROM public.units WHERE owner_user_id = auth.uid()))
  )
  WITH CHECK (
    public.is_master_admin(auth.uid())
    OR (public.has_management_role(auth.uid()) AND unit_id IN (SELECT id FROM public.units WHERE owner_user_id = auth.uid()))
  );

-- ============ QUERIES ============
DROP POLICY IF EXISTS "admin all queries" ON public.queries;

CREATE POLICY "admin all queries" ON public.queries
  FOR ALL TO authenticated
  USING (
    public.is_master_admin(auth.uid())
    OR (public.has_management_role(auth.uid()) AND unit_id IN (SELECT id FROM public.units WHERE owner_user_id = auth.uid()))
  )
  WITH CHECK (
    public.is_master_admin(auth.uid())
    OR (public.has_management_role(auth.uid()) AND unit_id IN (SELECT id FROM public.units WHERE owner_user_id = auth.uid()))
  );

-- ============ ANNOUNCEMENTS ============
-- Announcements are society-wide; no scoping needed.

-- Grant execute on new function
GRANT EXECUTE ON FUNCTION public.is_master_admin(uuid) TO authenticated;
