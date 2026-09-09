import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL not found in .env');
  process.exit(1);
}

// Simple bcrypt-like hash using Node.js crypto (for seeding only)
async function hashPassword(password) {
  const { default: bcryptModule } = await import('bcrypt');
  return bcryptModule.hash(password, 10);
}

console.log('🌱 Seeding database via WebSocket...');
const pool = new Pool({ connectionString });

try {
  const passwordHash = await hashPassword('admin123');
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 25);

  // Upsert admin user
  await pool.query(`
    INSERT INTO admins (id, email, password_hash, name, role, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      updated_at = NOW()
  `, [id, 'admin@equb.et', passwordHash, 'System Admin', 'ADMIN']);

  console.log('✅ Admin created: admin@equb.et (password: admin123)');
  console.log('');
  console.log('⚠️  Change the default password after first login!');
} catch (error) {
  console.error('❌ Seed failed:', error.message);
  process.exit(1);
} finally {
  await pool.end();
}
