-- Migration: Add unique constraints on owner_phone to prevent duplicate mobile numbers

-- Add unique constraint on owner_phone (allows multiple NULLs, but only one non-NULL value)
ALTER TABLE public.units
ADD CONSTRAINT units_owner_phone_unique UNIQUE (owner_phone);

-- Add unique constraint on phone (allows multiple NULLs, but only one non-NULL value)
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_phone_unique UNIQUE (phone);