// Sends result emails for auctions that have closed. Run every minute from cron / Task Scheduler:
//   npm run settle
try { process.loadEnvFile(); } catch { /* env may come from the shell instead */ }

import { db } from '../src/lib/db';
import { settleEndedAuctions } from '../src/lib/notify';

settleEndedAuctions()
  .then(n => console.log(`Settled ${n} auction(s).`))
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
