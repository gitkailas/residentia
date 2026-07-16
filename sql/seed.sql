-- Seed data for Residentia (sample data for testing)
-- NOTE: Password hashes are placeholders. Use bcrypt to generate real ones.

-- Insert master admin user (password: master@123)
INSERT INTO public.users (email, password_hash, role)
VALUES ('master@residentia.local', '$2b$10$Xy8C2oWhpFN3pzhVmJ82.eqAjmRjGCwSE1h.tj3cgQUKoKBRBBKnO', 'master_admin')
ON CONFLICT DO NOTHING;

-- Insert sample resident user (password: resident@123)
INSERT INTO public.users (email, password_hash, role)
VALUES ('resident@residentia.local', '$2b$10$9hDLwvZGU/8EYgVEiUZKfOxA1Q7PfAYYvBKD0T1z6QqV4pZrE8Ezi', 'resident')
ON CONFLICT DO NOTHING;

-- Insert owner user madhusoodhanan (password: owner@123)
INSERT INTO public.users (email, password_hash, role)
VALUES ('madhusoodhanan@residentia.local', '$2b$10$Xy8C2oWhpFN3pzhVmJ82.eqAjmRjGCwSE1h.tj3cgQUKoKBRBBKnO', 'owner')
ON CONFLICT DO NOTHING;

-- Insert user_roles entries
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'master_admin' FROM public.users WHERE email = 'master@residentia.local'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'resident' FROM public.users WHERE email = 'resident@residentia.local'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner' FROM public.users WHERE email = 'madhusoodhanan@residentia.local'
ON CONFLICT DO NOTHING;

-- Insert sample units (owner_user_id left NULL — assign via Manage Owners)
INSERT INTO public.units (unit_no, floor, type, owner_name, owner_email, owner_phone, status, billing_enabled, property_name, maintenance_fee, garbage_fee, monthly_rent)
VALUES
  ('A101', 1, '3BHK', 'John Smith', 'john@example.com', '9876543210', 'sold', TRUE, NULL, 1900, 100, 0),
  ('A102', 1, '2BHK', 'Jane Doe', 'jane@example.com', '9876543211', 'sold', TRUE, NULL, 1550, 100, 0),
  ('A201', 2, '3BHK', 'Robert Johnson', 'robert@example.com', '9876543212', 'sold', TRUE, NULL, 1900, 100, 0),
  ('A202', 2, '1BHK', 'Alice Brown', 'alice@example.com', '9876543213', 'vacant', FALSE, NULL, 1200, 100, 0),
  ('A301', 3, '3BHK', 'Michael Davis', 'michael@example.com', '9876543214', 'sold', TRUE, NULL, 1900, 100, 0),
  ('B101', 1, '2BHK', 'Sarah Wilson', 'sarah@example.com', '9876543215', 'sold', TRUE, NULL, 1550, 100, 0),
  ('B102', 1, '1BHK', 'David Lee', 'david@example.com', '9876543216', 'sold', TRUE, NULL, 1200, 100, 0)
ON CONFLICT DO NOTHING;

-- Insert units for madhusoodhanan owner (linked via owner_user_id)
INSERT INTO public.units (unit_no, floor, type, owner_name, owner_email, owner_phone, owner_user_id, status, billing_enabled, property_name, occupancy_type, maintenance_fee, garbage_fee, monthly_rent)
SELECT 'C101', 3, '3BHK', 'Madhusoodhanan', 'madhusoodhanan@residentia.local', '9876543217', id, 'sold', TRUE, 'Lakeview 3BHK', 'rented', 1900, 100, 15000
FROM public.users WHERE email = 'madhusoodhanan@residentia.local'
ON CONFLICT DO NOTHING;

INSERT INTO public.units (unit_no, floor, type, owner_name, owner_email, owner_phone, owner_user_id, status, billing_enabled, property_name, occupancy_type, maintenance_fee, garbage_fee, monthly_rent)
SELECT 'C102', 3, '2BHK', 'Madhusoodhanan', 'madhusoodhanan@residentia.local', '9876543218', id, 'sold', TRUE, 'Garden View 2BHK', 'rented', 1550, 100, 12000
FROM public.users WHERE email = 'madhusoodhanan@residentia.local'
ON CONFLICT DO NOTHING;

-- Insert sample billing cycles for current month
INSERT INTO public.billing_cycles (unit_id, month, year, maintenance_due, garbage_due, total_due, is_waiver_period)
SELECT id, 'June', 2026, 4000.00, 1000.00, 5000.00, FALSE FROM public.units WHERE unit_no IN ('A101', 'A102', 'A201', 'A301', 'B101', 'B102')
ON CONFLICT DO NOTHING;

-- Insert sample payments
INSERT INTO public.payments (unit_id, amount_maintenance, amount_garbage, total_paid, balance, status, payment_mode, payment_date)
SELECT id, 2000.00, 500.00, 2500.00, 2500.00, 'PARTIAL', 'UPI', CURRENT_DATE - INTERVAL '7 days' FROM public.units WHERE unit_no IN ('A101', 'A102')
ON CONFLICT DO NOTHING;

-- Insert sample queries
INSERT INTO public.queries (unit_id, subject, description, status)
SELECT id, 'Maintenance Issue', 'There is a water leak in the apartment', 'Open' FROM public.units WHERE unit_no = 'A101'
ON CONFLICT DO NOTHING;

INSERT INTO public.queries (unit_id, subject, description, status)
SELECT id, 'Billing Inquiry', 'I would like to know the billing details', 'Open' FROM public.units WHERE unit_no = 'A102'
ON CONFLICT DO NOTHING;

-- Insert sample announcements
INSERT INTO public.announcements (title, message)
VALUES
  ('Annual General Meeting', 'The AGM for the year 2026 is scheduled on July 15, 2026 at 6:00 PM in the community hall.'),
  ('Maintenance Notice', 'Building maintenance will be conducted on weekends from 9 AM to 2 PM.'),
  ('New Amenities', 'A new gym and library are now available for all residents. Please register at the office.')
ON CONFLICT DO NOTHING;

-- Insert tenants for madhusoodhanan's units (only Kailas V and Joshymon)
-- Create tenants table if it doesn't exist (for local environments)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.tenants (unit_id, name, phone, email)
SELECT id, 'Kailas V', '9446854035', 'kailas@example.com' FROM public.units WHERE unit_no = 'C101'
ON CONFLICT DO NOTHING;

INSERT INTO public.tenants (unit_id, name, phone, email)
SELECT id, 'Joshymon', '9446854036', 'joshymon@example.com' FROM public.units WHERE unit_no = 'C102'
ON CONFLICT DO NOTHING;

-- Insert sample pricing (for madhusoodhanan owner, if exists)
INSERT INTO public.pricing (unit_type, monthly_rent, created_by)
SELECT '1BHK', 3000.00, id FROM public.users WHERE email = 'madhusoodhanan@residentia.local'
UNION ALL
SELECT '2BHK', 6000.00, id FROM public.users WHERE email = 'madhusoodhanan@residentia.local'
UNION ALL
SELECT '3BHK', 9000.00, id FROM public.users WHERE email = 'madhusoodhanan@residentia.local'
UNION ALL
SELECT '4BHK', 12000.00, id FROM public.users WHERE email = 'madhusoodhanan@residentia.local'
UNION ALL
SELECT '5BHK', 15000.00, id FROM public.users WHERE email = 'madhusoodhanan@residentia.local'
UNION ALL
SELECT '6BHK', 18000.00, id FROM public.users WHERE email = 'madhusoodhanan@residentia.local'
ON CONFLICT DO NOTHING;

-- Insert sample waivers
INSERT INTO public.waivers (unit_id, waiver_type, original_amount, waiver_amount, final_amount, reason, status)
SELECT id, 'Manual', 5000.00, 2500.00, 2500.00, 'Medical emergency', 'Approved' FROM public.units WHERE unit_no = 'A301'
ON CONFLICT DO NOTHING;
