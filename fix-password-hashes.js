import { Pool } from 'pg';
import bcryptjs from 'bcryptjs';

const pool = new Pool({
  connectionString: 'postgres://residentia_user:ResidentiaPass123!@localhost:5432/residentia'
});

async function fixPasswords() {
  try {
    const adminHash = await bcryptjs.hash('admin@123', 10);
    const residentHash = await bcryptjs.hash('resident@123', 10);

    console.log('Generated hashes:');
    console.log('admin@123 ->', adminHash);
    console.log('resident@123 ->', residentHash);

    // Update admin user
    const adminResult = await pool.query(
      'UPDATE public.users SET password_hash = $1 WHERE email = $2 RETURNING email, password_hash',
      [adminHash, 'admin@residentia.local']
    );
    console.log('Updated admin:', adminResult.rows[0]);

    // Update resident user
    const residentResult = await pool.query(
      'UPDATE public.users SET password_hash = $1 WHERE email = $2 RETURNING email, password_hash',
      [residentHash, 'resident@residentia.local']
    );
    console.log('Updated resident:', residentResult.rows[0]);

    // Verify
    const verify = await pool.query('SELECT email, password_hash FROM public.users');
    console.log('\nAll users:');
    console.log(verify.rows);

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fixPasswords();
