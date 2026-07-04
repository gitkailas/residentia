-- Migration: Fix billing_enabled for existing units that were corrupted by the PropertyDialog bug
-- The PropertyDialog was sending billing_enabled: false on every edit, overwriting the correct value.
-- The trigger trg_units_compute_waiver exists and should prevent this going forward,
-- but existing rows that were updated by the buggy code need to be fixed.

UPDATE public.units
SET billing_enabled =
  CASE
    WHEN status = 'sold' AND waiver_end_date IS NOT NULL AND CURRENT_DATE > waiver_end_date THEN true
    WHEN status = 'sold' AND waiver_end_date IS NULL THEN true
    ELSE false
  END
WHERE billing_enabled IS DISTINCT FROM (
  CASE
    WHEN status = 'sold' AND waiver_end_date IS NOT NULL AND CURRENT_DATE > waiver_end_date THEN true
    WHEN status = 'sold' AND waiver_end_date IS NULL THEN true
    ELSE false
  END
);
