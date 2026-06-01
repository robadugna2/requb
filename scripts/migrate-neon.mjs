import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL not found in .env');
  process.exit(1);
}

console.log('🔌 Connecting to Neon via WebSocket...');
const pool = new Pool({ connectionString });

const migrationFile = path.resolve(__dirname, '..', 'migration.sql');
if (!fs.existsSync(migrationFile)) {
  console.error('❌ migration.sql not found. Generate it first with:');
  console.error('   npx prisma migrate diff --from-empty --to-schema-datamodel=packages/database/prisma/schema.prisma --script > migration.sql');
  process.exit(1);
}

const sql = fs.readFileSync(migrationFile, 'utf-8');

try {
  await pool.query(sql);
  console.log('✅ Migration completed successfully!');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  await pool.end();
}
