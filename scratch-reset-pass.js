const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function run() {
  const email = 'tesfay_alemkahsay@gmail.com';
  const newPass = await bcrypt.hash('Password123!', 10);
  
  await prisma.admin.update({
    where: { email },
    data: { passwordHash: newPass }
  });
  console.log("Password reset successfully.");
}
run().then(() => prisma.$disconnect());
