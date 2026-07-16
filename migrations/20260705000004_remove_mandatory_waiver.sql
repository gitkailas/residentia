-- Remove the mandatory 6-month waiver enforcement from the trigger.
-- Waiver dates (waiver_start_date, waiver_end_date) are still computed for reference,
-- but billing_enabled is now set to true for all sold units by default.
-- The admin can still manually set billing_enabled = false for specific waivers.

CREATE OR REPLACE FUNCTION public.units_compute_waiver()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Compute waiver dates for reference (informational only)
  IF NEW.registration_date IS NOT NULL AND NEW.key_handover_date IS NOT NULL THEN
    NEW.waiver_start_date := LEAST(NEW.registration_date, NEW.key_handover_date);
  ELSIF NEW.registration_date IS NOT NULL THEN
    NEW.waiver_start_date := NEW.registration_date;
  ELSIF NEW.key_handover_date IS NOT NULL THEN
    NEW.waiver_start_date := NEW.key_handover_date;
  ELSE
    NEW.waiver_start_date := NULL;
  END IF;

  IF NEW.waiver_start_date IS NOT NULL THEN
    NEW.waiver_end_date := NEW.waiver_start_date + INTERVAL '6 months';
  ELSE
    NEW.waiver_end_date := NULL;
  END IF;

  -- Set billing_enabled: sold units are billable by default.
  -- The admin can manually set billing_enabled = false for explicit waivers.
  IF NEW.status = 'sold' THEN
    NEW.billing_enabled := true;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Set billing_enabled = true for all existing sold units.
-- Previously this was controlled by the 6-month waiver rule.
UPDATE public.units SET billing_enabled = true WHERE status = 'sold' AND billing_enabled = false;
