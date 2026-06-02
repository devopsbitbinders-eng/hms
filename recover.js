const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const owners = await prisma.user.findMany({ where: { role: 'Owner' } });
  if (owners.length > 0) {
    const primaryOwner = owners[0];
    console.log(`Assigning orphaned properties to owner: ${primaryOwner.username} (${primaryOwner.id})`);
    
    const result = await prisma.property.updateMany({
      where: { ownerId: null },
      data: { ownerId: primaryOwner.id }
    });
    
    console.log(`Updated ${result.count} properties.`);
  } else {
    console.log('No owner found.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
