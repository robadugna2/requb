const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const email = 'admin@equb.et';
  const inputPassword = 'admin123';

  console.log(`🔐 Testing password validation for: ${email}`);
  const admin = await prisma.admin.findUnique({
    where: { email },
  });

  if (!admin) {
    console.log('❌ Admin user not found in the database!');
    return;
  }

  const isMatch = await bcrypt.compare(inputPassword, admin.passwordHash);
  if (isMatch) {
    console.log('✅ Success! The password "admin123" is correct and matches the database hash.');
  } else {
    console.log('❌ Failed! The password "admin123" does not match the database hash.');
  }
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
