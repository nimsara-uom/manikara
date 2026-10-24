// Usage: npm run make-admin -- someone@example.com
try { process.loadEnvFile(); } catch { /* env may come from the shell instead */ }

import { db } from '../src/lib/db';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: npm run make-admin -- <email>');
    process.exit(1);
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No account for ${email}. Register on the site first.`);
    process.exit(1);
  }
  await db.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
  console.log(`${email} is now an admin.`);
}

main().finally(() => db.$disconnect());
