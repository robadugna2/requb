const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const adminEmail = 'robadugna19@gmail.com';
  
  // Find standard admin
  const admin = await prisma.admin.findUnique({
    where: { email: adminEmail }
  });
  console.log("Admin:", admin);

  if (admin) {
    const groups = await prisma.equbGroup.findMany({
      where: { createdById: admin.id }
    });
    console.log("Groups created by admin:", groups.map(g => ({ id: g.id, name: g.name })));

    const leaders = await prisma.groupLeader.findMany({
      where: { adminId: admin.id }
    });
    console.log("GroupLeader entries for admin:", leaders);
  }
}

check().then(() => prisma.$disconnect());
