-- Fix corrupted billing cycle totals caused by client-side string concatenation bug
-- The total_due may have been computed from string values instead of numbers,
-- resulting in inflated amounts like '1550100' instead of 1650.
UPDATE public.billing_cycles
SET total_due = COALESCE(maintenance_due, 0) + COALESCE(garbage_due, 0) + COALESCE(rent_due, 0)
WHERE total_due IS DISTINCT FROM (COALESCE(maintenance_due, 0) + COALESCE(garbage_due, 0) + COALESCE(rent_due, 0));
