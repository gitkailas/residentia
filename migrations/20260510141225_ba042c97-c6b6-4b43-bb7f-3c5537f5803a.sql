
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'resident');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ UNITS ============
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_no text NOT NULL UNIQUE,
  floor integer NOT NULL,
  type text NOT NULL CHECK (type IN ('2BHK','3BHK')),
  status text NOT NULL DEFAULT 'unsold' CHECK (status IN ('sold','unsold','vacant')),
  owner_name text,
  registration_date date,
  key_handover_date date,
  waiver_start_date date,
  waiver_end_date date,
  billing_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Trigger: auto-calc waiver dates + billing_enabled
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

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own profile or admin" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "admin manage profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email);
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Units RLS (depends on profiles)
CREATE POLICY "admin all units" ON public.units
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "resident reads own unit" ON public.units
  FOR SELECT TO authenticated USING (
    id IN (SELECT unit_id FROM public.profiles WHERE id = auth.uid())
  );

-- ============ TENANTS ============
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all tenants" ON public.tenants
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "resident reads own tenants" ON public.tenants
  FOR SELECT TO authenticated USING (
    unit_id IN (SELECT unit_id FROM public.profiles WHERE id = auth.uid())
  );

-- ============ BILLING CYCLES ============
CREATE TABLE public.billing_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  month text NOT NULL,
  year integer NOT NULL,
  maintenance_due numeric(10,2) NOT NULL DEFAULT 0,
  garbage_due numeric(10,2) NOT NULL DEFAULT 0,
  total_due numeric(10,2) NOT NULL DEFAULT 0,
  is_waiver_period boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, month, year)
);
ALTER TABLE public.billing_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all billing" ON public.billing_cycles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "resident reads own billing" ON public.billing_cycles
  FOR SELECT TO authenticated USING (
    unit_id IN (SELECT unit_id FROM public.profiles WHERE id = auth.uid())
  );

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_cycle_id uuid REFERENCES public.billing_cycles(id) ON DELETE SET NULL,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  amount_maintenance numeric(10,2) NOT NULL DEFAULT 0,
  amount_garbage numeric(10,2) NOT NULL DEFAULT 0,
  total_paid numeric(10,2) NOT NULL DEFAULT 0,
  balance numeric(10,2) NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_mode text CHECK (payment_mode IN ('UPI','NEFT','Cash','Cheque')),
  reference_no text,
  proof_url text,
  status text NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('PAID','UNPAID','PARTIAL','ADVANCE PAID','WAIVER PERIOD','PENDING VERIFICATION')),
  recorded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all payments" ON public.payments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "resident reads own payments" ON public.payments
  FOR SELECT TO authenticated USING (
    unit_id IN (SELECT unit_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "resident submits own payment proof" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (
    unit_id IN (SELECT unit_id FROM public.profiles WHERE id = auth.uid())
    AND status = 'PENDING VERIFICATION'
  );

-- ============ WAIVERS ============
CREATE TABLE public.waivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  waiver_type text NOT NULL CHECK (waiver_type IN ('AUTO','MANUAL')),
  billing_cycle_id uuid REFERENCES public.billing_cycles(id) ON DELETE SET NULL,
  original_amount numeric(10,2) NOT NULL DEFAULT 0,
  waiver_amount numeric(10,2) NOT NULL DEFAULT 0,
  final_amount numeric(10,2) NOT NULL DEFAULT 0,
  reason text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  status text NOT NULL DEFAULT 'Pending Approval' CHECK (status IN ('Pending Approval','Approved','Rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.waivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all waivers" ON public.waivers
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "resident reads own waivers" ON public.waivers
  FOR SELECT TO authenticated USING (
    unit_id IN (SELECT unit_id FROM public.profiles WHERE id = auth.uid())
  );

-- ============ QUERIES ============
CREATE TABLE public.queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In Progress','Resolved')),
  admin_reply text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all queries" ON public.queries
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "resident reads own queries" ON public.queries
  FOR SELECT TO authenticated USING (
    unit_id IN (SELECT unit_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "resident creates own queries" ON public.queries
  FOR INSERT TO authenticated WITH CHECK (
    unit_id IN (SELECT unit_id FROM public.profiles WHERE id = auth.uid())
  );

-- ============ ANNOUNCEMENTS ============
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all read announcements" ON public.announcements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write announcements" ON public.announcements
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs','payment-proofs', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "admin read all proofs" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "users upload proofs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-proofs');
CREATE POLICY "users read own proofs" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'payment-proofs' AND owner = auth.uid());
