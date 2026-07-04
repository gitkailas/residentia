
-- Migration: Remove all tenants from madhusoodhanan's units except Kailas V and Joshymon
-- Prerequisites:
--   1. madhusoodhanan@residentia.local exists as a user with role 'owner'
--   2. units with owner_user_id pointing to this user exist
--   3. tenants table exists
--
-- This cleanup ensures only Kailas V and Joshymon remain as tenants under
-- units owned by madhusoodhanan@residentia.local.

DELETE FROM public.tenants
WHERE unit_id IN (
  SELECT u.id FROM public.units u
  JOIN public.users us ON us.id = u.owner_user_id
  WHERE us.email = 'madhusoodhanan@residentia.local'
)
AND name NOT IN ('Kailas V', 'Joshymon');
