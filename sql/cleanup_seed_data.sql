-- Cleanup all seed/test data
-- Keeps: master_admin user, any real owners/units added via the app
-- All related records (payments, billing, queries, waivers, etc.) cascade-delete automatically

BEGIN;

DELETE FROM public.announcements WHERE title IN ('Annual General Meeting','Maintenance Notice','New Amenities');
DELETE FROM public.units WHERE unit_no IN ('A101','A102','A201','A202','A301','B101','B102','C101','C102');
DELETE FROM public.users WHERE email IN ('resident@residentia.local','madhusoodhanan@residentia.local');

COMMIT;
