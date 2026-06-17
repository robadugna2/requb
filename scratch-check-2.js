const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const adminId = 'cmqh5kd3i0002setf5upjobg9'; // The standard admin
  
  const admin = await prisma.admin.findUnique({
    where: { id: adminId }
  });
  console.log("Standard Admin:", admin);

  if (admin) {
    const groups = await prisma.equbGroup.findMany({
      where: { createdById: admin.id }
    });
    console.log("Groups created by admin:", groups.map(g => ({ id: g.id, name: g.name })));

    const leaders = await prisma.groupLeader.findMany({
      where: { adminId: admin.id }
    });
    console.log("GroupLeader entries for standard admin:", leaders);
  }
}

check().then(() => prisma.$disconnect());
