-- Move UPI ID from units to profiles (single UPI ID per owner, not per unit)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS upi_id VARCHAR(255);

-- Migrate existing data: for each unit with upi_id, copy it to the owner's profile
-- (if the owner has a profile record, i.e. a user account)
UPDATE public.profiles p
SET upi_id = u.upi_id
FROM public.units u
WHERE u.owner_user_id = p.id
  AND u.upi_id IS NOT NULL
  AND p.upi_id IS NULL;

ALTER TABLE public.units
  DROP COLUMN IF EXISTS upi_id;
