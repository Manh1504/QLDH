// Seed OWNER đầu tiên. Chạy sau migrate. Pass đổi ngay sau khi login.
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
async function main() {
  const hash = await argon2.hash('owner123');
  await prisma.user.upsert({
    where: { username: 'owner' },
    update: {},
    create: { username: 'owner', passwordHash: hash, name: 'Owner', roles: ['OWNER', 'ADMIN'] },
  });
  console.log('seeded owner/owner123');
}
main().finally(() => prisma.$disconnect());
