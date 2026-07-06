-- Residentia PostgreSQL Schema
-- Complete database setup for the resident management portal

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (for authentication)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'resident',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User roles (for role management)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Profiles table (links user accounts to units for resident portal access)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    phone TEXT UNIQUE,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Units table (apartment units)
CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_no VARCHAR(50) UNIQUE NOT NULL,
    floor INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    owner_name VARCHAR(255),
    owner_email VARCHAR(255),
    owner_phone VARCHAR(20) UNIQUE,
    owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'unsold',
    billing_enabled BOOLEAN NOT NULL DEFAULT false,
    registration_date DATE,
    key_handover_date DATE,
    waiver_start_date DATE,
    waiver_end_date DATE,
    property_name VARCHAR(255),
    description TEXT,
    area_sqft INT,
    occupancy_type VARCHAR(20) NOT NULL DEFAULT 'owner_occupied',
    maintenance_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    garbage_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    monthly_rent DECIMAL(10,2) NOT NULL DEFAULT 0,
    pay_by_day INT NOT NULL DEFAULT 20,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger: auto-calc waiver dates + billing_enabled on any unit change
CREATE OR REPLACE FUNCTION public.units_compute_waiver()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
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

  IF NEW.status = 'sold' AND NEW.waiver_end_date IS NOT NULL AND CURRENT_DATE > NEW.waiver_end_date THEN
    NEW.billing_enabled := true;
  ELSIF NEW.status = 'sold' AND NEW.waiver_end_date IS NULL THEN
    NEW.billing_enabled := true;
  ELSE
    NEW.billing_enabled := false;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_units_compute_waiver
  BEFORE INSERT OR UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.units_compute_waiver();

-- Fix existing corrupted data: recalculate billing_enabled for all units
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

-- Billing cycles table (monthly billing periods)
CREATE TABLE IF NOT EXISTS public.billing_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    month VARCHAR(20) NOT NULL,
    year INT NOT NULL,
    period_start DATE,
    period_end DATE,
    days_billed INT,
    due_date DATE,
    maintenance_due DECIMAL(10, 2) NOT NULL DEFAULT 0,
    garbage_due DECIMAL(10, 2) NOT NULL DEFAULT 0,
    rent_due DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_due DECIMAL(10, 2) NOT NULL DEFAULT 0,
    is_waiver_period BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(unit_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_billing_cycles_period_start ON public.billing_cycles(period_start);

-- Payments table (payment records)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    billing_cycle_id UUID REFERENCES public.billing_cycles(id) ON DELETE SET NULL,
    amount_maintenance DECIMAL(10, 2) NOT NULL DEFAULT 0,
    amount_garbage DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_mode VARCHAR(50),
    reference_no VARCHAR(255),
    proof_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'UNPAID',
    recorded_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Queries/Support tickets table
CREATE TABLE IF NOT EXISTS public.queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    admin_reply TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Waivers table (payment waivers)
CREATE TABLE IF NOT EXISTS public.waivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    waiver_type VARCHAR(50) NOT NULL,
    billing_cycle_id UUID REFERENCES public.billing_cycles(id) ON DELETE SET NULL,
    original_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    waiver_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    final_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending Approval',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pricing table (owner-defined monthly rent per unit type)
CREATE TABLE IF NOT EXISTS public.pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_type VARCHAR(50) NOT NULL,
    monthly_rent DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(unit_type, created_by)
);

-- Announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_units_unit_no ON public.units(unit_no);
CREATE INDEX IF NOT EXISTS idx_billing_cycles_unit_id ON public.billing_cycles(unit_id);
CREATE INDEX IF NOT EXISTS idx_payments_unit_id ON public.payments(unit_id);
CREATE INDEX IF NOT EXISTS idx_queries_unit_id ON public.queries(unit_id);
CREATE INDEX IF NOT EXISTS idx_waivers_unit_id ON public.waivers(unit_id);
CREATE INDEX IF NOT EXISTS idx_units_owner_user_id ON public.units(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_pricing_created_by ON public.pricing(created_by);
CREATE INDEX IF NOT EXISTS idx_profiles_unit_id ON public.profiles(unit_id);

-- Grant permissions to residentia_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO residentia_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO residentia_user;
GRANT USAGE ON SCHEMA public TO residentia_user;
