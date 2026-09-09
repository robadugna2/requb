import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin account
  const passwordHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.admin.upsert({
    where: { email: 'admin@equb.et' },
    update: {},
    create: {
      email: 'admin@equb.et',
      passwordHash,
      name: 'System Admin',
      role: 'ADMIN',
    },
  });

  console.log(`✅ Admin created: ${admin.email} (password: admin123)`);
  console.log('');
  console.log('⚠️  Change the default password after first login!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
