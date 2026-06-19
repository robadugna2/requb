const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ADMIN_EMAIL = 'tesfay_alemkahsay@gmail.com';
const GROUP_NAME = 'RAT';
const KNOWN_GROUP_ID = 'cmqh5w5ft0004setfpb6z2jde';

const members = [
  { name: 'Abdelfetah Riedwan', shares: 1 },
  { name: 'Abel Birhane Faye', shares: 3 },
  { name: 'Abraham Zerezgi Wmicaiel', shares: 0.25 },
  { name: 'Adane Abeje Ayalew', shares: 1 },
  { name: 'Anteneh Demelash Tafese', shares: 3 },
  { name: 'Ashenafi Yohannis Mehari', shares: 1 },
  { name: 'Bilal Bahru Redi', shares: 1 },
  { name: 'Birhanu Elias Gajabo', shares: 0.5 },
  { name: 'Daniel Mnyelet', shares: 1 },
  { name: 'Dawit Gezaehagn', shares: 2 },
  { name: 'Dejen Alem Kahsay', shares: 0.25 },
  { name: 'Demelash Dereje Degefe', shares: 0.5 },
  { name: 'Dereje Gashaw', shares: 2 },
  { name: 'Edilu Sema Zebere', shares: 0.5 },
  { name: 'Elias Abebe W/Michael', shares: 0.5 },
  { name: 'Frehiwet Nega Haftie', shares: 1.5 },
  { name: 'Getachew Tazera Welalign', shares: 1 },
  { name: 'Gereziher Nguse', shares: 0.25 },
  { name: 'Hailemariam Munie', shares: 2 },
  { name: 'Hamida Gosa', shares: 2 },
  { name: 'Hayelom Yohanes Mahari', shares: 1 },
  { name: 'Ismael Mohammed Idris', shares: 1 },
  { name: 'Jilaluden Alewi Muzeyn', shares: 0.5 },
  { name: 'Kahasse Asgele Haile', shares: 0.25 },
  { name: 'Manalesh Gezahegn Birega', shares: 2 },
  { name: 'Meseret Demelash', shares: 1 },
  { name: 'Michael Mesmeru Tiruneh', shares: 2 },
  { name: 'Misrak Mulugeta Kebede', shares: 0.5 },
  { name: 'Mubarek Adibeb Hassen', shares: 0.5 },
  { name: 'Nebyi Tekle', shares: 1 },
  { name: 'Netsanet Demelash Tafes', shares: 1 },
  { name: 'Rishan Tekle Hadgu', shares: 0.5 },
  { name: 'Selam Tsegaye Mekonnen', shares: 0.5 },
  { name: 'Shemsedin Kedir Beleker', shares: 0.5 },
  { name: 'Sifen Tokoma', shares: 0.5 },
  { name: 'Tabor Belda Gurmu', shares: 0.5 },
  { name: 'Tefetere Negash Abaerie', shares: 2 },
  { name: 'Teklit Keflay Lemlem', shares: 0.5 },
  { name: 'Tesfalidet Teklezghi H/Michael', shares: 1 },
  { name: 'Tesfay Alem Kahsay', shares: 2 },
  { name: 'Teshome Daniel Aruse', shares: 1 },
  { name: 'Tsegaye Feseha Asfaw', shares: 0.5 },
  { name: 'Urge', shares: 0.25 },
  { name: 'Wubliker Mengistu Abebe', shares: 1 },
  { name: 'Zelalem Demelash Tafese', shares: 0.5 },
  { name: 'Zelalem Tesfaye Bekele', shares: 3 },
];

async function main() {
  console.log('🌱 Seeding RAT group members...\n');

  // 1. Find the admin
  const admin = await prisma.admin.findUnique({
    where: { email: ADMIN_EMAIL },
  });
  if (!admin) {
    throw new Error(`Admin with email ${ADMIN_EMAIL} not found`);
  }
  console.log(`✅ Found admin: ${admin.name} (${admin.email})`);

  // 2. Find the RAT group
  let group = await prisma.equbGroup.findFirst({
    where: { name: GROUP_NAME, createdById: admin.id, deletedAt: null },
  });
  if (!group) {
    group = await prisma.equbGroup.findUnique({ where: { id: KNOWN_GROUP_ID } });
  }
  if (!group) {
    throw new Error(`Group "${GROUP_NAME}" not found for admin ${ADMIN_EMAIL}`);
  }
  console.log(`✅ Found group: ${group.name} (ID: ${group.id})`);

  // 3. Update maxMembers if needed
  if (group.maxMembers < members.length) {
    await prisma.equbGroup.update({
      where: { id: group.id },
      data: { maxMembers: members.length },
    });
    console.log(`📐 Updated maxMembers from ${group.maxMembers} to ${members.length}`);
  }

  // 4. Create users and memberships
  let usersCreated = 0;
  let usersUpdated = 0;
  let membershipsCreated = 0;
  let membershipsUpdated = 0;

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const phone = `09001000${String(i + 1).padStart(2, '0')}`;

    // Upsert user by phone
    const existingUser = await prisma.user.findUnique({ where: { phone } });
    let user;
    if (existingUser) {
      user = await prisma.user.update({
        where: { phone },
        data: { name: member.name },
      });
      usersUpdated++;
    } else {
      user = await prisma.user.create({
        data: { name: member.name, phone },
      });
      usersCreated++;
    }

    // Upsert membership
    const existingMembership = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: user.id } },
    });
    if (existingMembership) {
      await prisma.groupMembership.update({
        where: { id: existingMembership.id },
        data: { shares: member.shares, status: 'ACTIVE' },
      });
      membershipsUpdated++;
    } else {
      await prisma.groupMembership.create({
        data: {
          groupId: group.id,
          userId: user.id,
          shares: member.shares,
          status: 'ACTIVE',
        },
      });
      membershipsCreated++;
    }

    console.log(`  [${i + 1}/${members.length}] ${member.name} — ${member.shares} share(s), phone: ${phone}`);
  }

  const totalShares = members.reduce((sum, m) => sum + m.shares, 0);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Summary:');
  console.log(`   Users created:        ${usersCreated}`);
  console.log(`   Users updated:        ${usersUpdated}`);
  console.log(`   Memberships created:  ${membershipsCreated}`);
  console.log(`   Memberships updated:  ${membershipsUpdated}`);
  console.log(`   Total shares:         ${totalShares}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✅ Done! Admin can update placeholder phone numbers later.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
