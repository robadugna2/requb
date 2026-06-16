const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@equb.et';
  const name = 'Super Admin';
  const password = 'Password123!';

  // Check if admin already exists
  const existingAdmin = await prisma.admin.findUnique({
    where: { email },
  });

  if (existingAdmin) {
    console.log(`Admin with email ${email} already exists. Checking role...`);
    if (existingAdmin.role !== 'SUPER_ADMIN') {
        await prisma.admin.update({
            where: { email },
            data: { role: 'SUPER_ADMIN' }
        });
        console.log(`Upgraded admin ${email} to SUPER_ADMIN.`);
    } else {
        console.log(`Admin ${email} is already SUPER_ADMIN.`);
    }
    return;
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const admin = await prisma.admin.create({
    data: {
      email,
      name,
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });

  console.log(`Successfully created admin user: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
