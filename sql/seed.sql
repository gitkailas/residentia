-- Seed data for Residentia (sample data for testing)
-- NOTE: Password hashes are placeholders. Use bcrypt to generate real ones.

-- Insert sample admin user (password: admin@123)
INSERT INTO public.users (email, password_hash, role) 
VALUES ('admin@residentia.local', '$2b$10$YY9vJYLJRy6aQUyX2XaIGO1n3hv4wDqE9f9I8dQqnZLdQ4pJ8k7pC', 'admin')
ON CONFLICT DO NOTHING;

-- Insert sample resident user (password: resident@123)
INSERT INTO public.users (email, password_hash, role)
VALUES ('resident@residentia.local', '$2b$10$9hDLwvZGU/8EYgVEiUZKfOxA1Q7PfAYYvBKD0T1z6QqV4pZrE8Ezi', 'resident')
ON CONFLICT DO NOTHING;

-- Insert sample units
INSERT INTO public.units (unit_no, floor, type, owner_name, owner_email, owner_phone, status, billing_enabled)
VALUES 
  ('A101', 1, '3BHK', 'John Smith', 'john@example.com', '9876543210', 'sold', TRUE),
  ('A102', 1, '2BHK', 'Jane Doe', 'jane@example.com', '9876543211', 'sold', TRUE),
  ('A201', 2, '3BHK', 'Robert Johnson', 'robert@example.com', '9876543212', 'sold', TRUE),
  ('A202', 2, '1BHK', 'Alice Brown', 'alice@example.com', '9876543213', 'vacant', FALSE),
  ('A301', 3, '3BHK', 'Michael Davis', 'michael@example.com', '9876543214', 'sold', TRUE),
  ('B101', 1, '2BHK', 'Sarah Wilson', 'sarah@example.com', '9876543215', 'sold', TRUE),
  ('B102', 1, '1BHK', 'David Lee', 'david@example.com', '9876543216', 'sold', TRUE)
ON CONFLICT DO NOTHING;

-- Insert sample billing cycles for current month
INSERT INTO public.billing_cycles (unit_id, month, year, total_due, is_waiver_period)
SELECT id, 'June', 2026, 5000.00, FALSE FROM public.units WHERE unit_no IN ('A101', 'A102', 'A201', 'A301', 'B101', 'B102')
ON CONFLICT DO NOTHING;

-- Insert sample payments
INSERT INTO public.payments (unit_id, total_paid, balance, status, payment_mode, payment_date)
SELECT id, 2500.00, 2500.00, 'partial', 'bank_transfer', NOW() - INTERVAL '7 days' FROM public.units WHERE unit_no IN ('A101', 'A102')
ON CONFLICT DO NOTHING;

-- Insert sample queries
INSERT INTO public.queries (unit_id, subject, message, status)
SELECT id, 'Maintenance Issue', 'There is a water leak in the apartment', 'open' FROM public.units WHERE unit_no = 'A101'
ON CONFLICT DO NOTHING;

INSERT INTO public.queries (unit_id, subject, message, status)
SELECT id, 'Billing Inquiry', 'I would like to know the billing details', 'open' FROM public.units WHERE unit_no = 'A102'
ON CONFLICT DO NOTHING;

-- Insert sample announcements
INSERT INTO public.announcements (title, message)
VALUES 
  ('Annual General Meeting', 'The AGM for the year 2026 is scheduled on July 15, 2026 at 6:00 PM in the community hall.'),
  ('Maintenance Notice', 'Building maintenance will be conducted on weekends from 9 AM to 2 PM.'),
  ('New Amenities', 'A new gym and library are now available for all residents. Please register at the office.')
ON CONFLICT DO NOTHING;

-- Insert sample waivers
INSERT INTO public.waivers (unit_id, waiver_start_date, waiver_end_date, reason, status)
SELECT id, '2026-06-01'::DATE, '2026-06-30'::DATE, 'Medical emergency', 'active' FROM public.units WHERE unit_no = 'A301'
ON CONFLICT DO NOTHING;
