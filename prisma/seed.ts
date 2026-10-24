// Development seed: wipes the database and fills it with demo users, gems and auctions.
try { process.loadEnvFile(); } catch { /* env may come from the shell instead */ }

import bcrypt from 'bcryptjs';
import { db } from '../src/lib/db';
import { placeBid } from '../src/lib/bidding';
import { factsFromGem, issueKey } from '../src/lib/gemkey';

const DEMO_PASSWORD = 'Manikara#2026';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const GEMS = [
  {
    name: 'The Kandy Cornflower', species: 'Sapphire', carat: 8.12, colorName: 'Cornflower blue', colorHex: '#3b5bdb',
    clarity: 'Eye clean', cut: 'Cushion, modified brilliant', origin: 'Sri Lanka (Ratnapura)', treatment: 'None (no indications of heating)',
    lab: 'SSEF', reportNo: 'SSEF-128734', dimensions: '12.41 × 10.88 × 7.02 mm',
    description: 'A saturated, evenly coloured Ceylon sapphire with strong brilliance across the table. Accompanied by an SSEF report confirming unheated status.',
  },
  {
    name: 'Mogok Ember', species: 'Ruby', carat: 3.05, colorName: 'Pigeon blood red', colorHex: '#c1121f',
    clarity: 'Slightly included', cut: 'Oval mixed cut', origin: 'Myanmar (Mogok)', treatment: 'None',
    lab: 'Gübelin', reportNo: 'GGL-22094117', dimensions: '9.64 × 7.81 × 4.55 mm',
    description: 'Intense red with the fluorescence characteristic of Mogok material. Fine silk adds a soft glow without dulling the stone.',
  },
  {
    name: 'Muzo Garden', species: 'Emerald', carat: 5.48, colorName: 'Vivid green', colorHex: '#1f9d55',
    clarity: 'Moderately included (jardin)', cut: 'Emerald cut', origin: 'Colombia (Muzo)', treatment: 'Minor oil',
    lab: 'AGL', reportNo: 'AGL-1102291', dimensions: '11.90 × 9.10 × 6.38 mm',
    description: 'Classic Muzo colour with a warm undertone. The garden of inclusions is typical and does not reach the surface.',
  },
  {
    name: 'Lotus Dawn', species: 'Padparadscha sapphire', carat: 2.31, colorName: 'Pinkish orange', colorHex: '#f08a5d',
    clarity: 'Eye clean', cut: 'Oval brilliant', origin: 'Sri Lanka', treatment: 'None',
    lab: 'GRS', reportNo: 'GRS2025-0417781', dimensions: '8.70 × 6.92 × 4.80 mm',
    description: 'A balanced lotus-blossom hue — neither too pink nor too orange — in an untreated stone.',
  },
  {
    name: 'Batalha Neon', species: 'Paraíba tourmaline', carat: 1.62, colorName: 'Electric blue-green', colorHex: '#14c3c3',
    clarity: 'Very slightly included', cut: 'Pear', origin: 'Brazil (Paraíba)', treatment: 'Heated',
    lab: 'GIA', reportNo: 'GIA-6234108852', dimensions: '9.30 × 6.40 × 4.05 mm',
    description: 'Copper-bearing tourmaline with the neon glow the material is named for.',
  },
];

async function main() {
  // Children first, so foreign keys are never violated
  await db.securityEvent.deleteMany();
  await db.otpCode.deleteMany();
  await db.rateLimit.deleteMany();
  await db.bid.deleteMany();
  await db.autoBid.deleteMany();
  await db.watch.deleteMany();
  await db.auction.deleteMany();
  await db.gemKey.deleteMany();
  await db.gemImage.deleteMany();
  await db.gem.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const emailVerifiedAt = new Date();
  const admin = await db.user.create({ data: { email: 'admin@manikara.test', name: 'House Admin', passwordHash, role: 'ADMIN', emailVerifiedAt } });
  const ana = await db.user.create({ data: { email: 'ana@manikara.test', name: 'Ana Perera', passwordHash, emailVerifiedAt } });
  const ben = await db.user.create({ data: { email: 'ben@manikara.test', name: 'Ben Silva', passwordHash, emailVerifiedAt } });

  const now = Date.now();
  // [startOffset, endOffset] relative to now
  const windows: [number, number][] = [
    [-DAY, 2 * DAY],
    [-2 * DAY, 6 * HOUR],
    [-DAY, 3 * DAY],
    [DAY, 5 * DAY], // upcoming
    [-4 * DAY, 4 * DAY], // will be closed after bidding
  ];
  const pricing = [
    { startingPrice: 18000, reservePrice: 25000, increment: 500 },
    { startingPrice: 9000, reservePrice: null, increment: 250 },
    { startingPrice: 12000, reservePrice: 15000, increment: 250 },
    { startingPrice: 6500, reservePrice: null, increment: 100 },
    { startingPrice: 4000, reservePrice: 5000, increment: 100 },
  ];

  const auctions = [];
  for (const [i, g] of GEMS.entries()) {
    // No photographs in the demo: the site shows a studio render in the stone's colour instead
    const gem = await db.gem.create({ data: g, include: { images: true } });
    await db.gemKey.create({ data: { gemId: gem.id, ...issueKey(factsFromGem(gem)) } });
    auctions.push(await db.auction.create({
      data: {
        gemId: gem.id,
        lotNumber: i + 1,
        ...pricing[i],
        startsAt: new Date(now + windows[i][0]),
        endsAt: new Date(now + windows[i][1]),
      },
    }));
  }

  // A little bidding history
  await placeBid(auctions[0].id, ana.id, 19000);
  await placeBid(auctions[0].id, ben.id, 21000);
  await placeBid(auctions[1].id, ben.id, 9500);
  await placeBid(auctions[1].id, ana.id, 12000);
  await placeBid(auctions[1].id, ben.id, 11000);
  await placeBid(auctions[4].id, ben.id, 4200);
  await placeBid(auctions[4].id, ana.id, 5200);
  // Closed in the past and already settled, so no result emails go out for demo data
  await db.auction.update({ where: { id: auctions[4].id }, data: { endsAt: new Date(now - HOUR), settledAt: new Date(now - HOUR) } });

  await db.watch.create({ data: { userId: ana.id, auctionId: auctions[0].id } });

  console.log(`Seeded ${GEMS.length} lots. Sign in as ${admin.email} / ana@manikara.test / ben@manikara.test with password "${DEMO_PASSWORD}".`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
