-- Add occupancy_type column to units table
-- Values: 'owner_occupied' (default), 'rented'
ALTER TABLE public.units
  ADD COLUMN occupancy_type VARCHAR(20) NOT NULL DEFAULT 'owner_occupied';

-- Existing heuristic: units with monthly_rent > 0 were likely rented
UPDATE public.units
  SET occupancy_type = 'rented'
  WHERE monthly_rent > 0;
