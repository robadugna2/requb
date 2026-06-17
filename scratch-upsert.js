const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const subAdminId = 'cmqh6f6cz000267mj4iefpm2v'; // Adanech Tilahun
  const groupId = 'cmqh5w5ft0004setfpb6z2jde'; // RAT
  
  try {
    const res = await prisma.groupLeader.upsert({
        where: { groupId_adminId: { groupId, adminId: subAdminId } },
        create: {
            groupId: groupId,
            adminId: subAdminId,
            canManageMembers: false,
            canManageDeposits: false,
            canTriggerLottery: false,
            canManageRules: false,
        },
        update: {
            canManageMembers: false,
            canManageDeposits: false,
            canTriggerLottery: false,
            canManageRules: false,
        }
    });
    console.log("Success:", res);
  } catch (e) {
    console.error("Prisma error:", e);
  }
}
run().then(() => prisma.$disconnect());
