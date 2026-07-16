import sqlite3
import os

path = os.path.join(os.getcwd(), 'residentia.db')
conn = sqlite3.connect(path)
conn.execute('PRAGMA foreign_keys = ON')
cur = conn.cursor()
cur.executescript('''
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  floor INTEGER NOT NULL,
  unit_no TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  billing_enabled INTEGER NOT NULL,
  owner_name TEXT,
  registration_date TEXT,
  key_handover_date TEXT,
  waiver_start_date TEXT,
  waiver_end_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_cycles (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL,
  month TEXT NOT NULL,
  year INTEGER NOT NULL,
  maintenance_due REAL NOT NULL,
  garbage_due REAL NOT NULL,
  total_due REAL NOT NULL,
  is_waiver_period INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(unit_id) REFERENCES units(id)
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL,
  billing_cycle_id TEXT,
  total_paid REAL NOT NULL,
  amount_maintenance REAL NOT NULL,
  amount_garbage REAL NOT NULL,
  balance REAL NOT NULL,
  payment_date TEXT NOT NULL,
  status TEXT NOT NULL,
  payment_mode TEXT,
  reference_no TEXT,
  proof_url TEXT,
  recorded_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(unit_id) REFERENCES units(id),
  FOREIGN KEY(billing_cycle_id) REFERENCES billing_cycles(id)
);
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  unit_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(unit_id) REFERENCES units(id)
);
CREATE TABLE IF NOT EXISTS queries (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  admin_reply TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(unit_id) REFERENCES units(id)
);
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  is_active INTEGER NOT NULL,
  unit_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(unit_id) REFERENCES units(id)
);
CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','resident')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS waivers (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL,
  billing_cycle_id TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  waiver_type TEXT NOT NULL,
  original_amount REAL NOT NULL,
  waiver_amount REAL NOT NULL,
  final_amount REAL NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(unit_id) REFERENCES units(id),
  FOREIGN KEY(billing_cycle_id) REFERENCES billing_cycles(id)
);
''')
conn.commit()
conn.close()
print(f'CREATED {path}')
