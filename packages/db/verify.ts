import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function m() {
  const r: any[] = await p.$queryRawUnsafe(
    `SELECT COUNT(*)::int o, COALESCE(SUM(total),0)::float t, COALESCE(SUM(paid),0)::float pd FROM "Order"`,
  );
  const pay: any[] = await p.$queryRawUnsafe(
    `SELECT COUNT(*)::int c, COALESCE(SUM(amount),0)::float s FROM "CustomerPayment"`,
  );
  console.log('DB orders:', r);
  console.log('DB payments:', pay);
}
m().finally(() => p.$disconnect());
