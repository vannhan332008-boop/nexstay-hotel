import { PrismaClient } from '@prisma/client';
import { resetDemoDatabase } from '../src/services/seedService.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Resetting and seeding NexStay Super VIP database...');
  const result = await resetDemoDatabase();
  console.log('✅ Super VIP Database seeded successfully!', result);
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
