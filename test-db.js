const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking database for admins...');
  const admins = await prisma.admin.findMany();
  console.log('Admins found in database:', admins.map(a => ({
    id: a.id,
    email: a.email,
    name: a.name,
    role: a.role,
    passwordHash: a.passwordHash
  })));
}

main()
  .catch((e) => {
    console.error('Error connecting to database:', e.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
