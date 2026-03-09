import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  // Dynamic import since generated client is TS
  const { createRequire } = await import('node:module');
  const mod = createRequire(import.meta.url);

  // Use raw mysql2 for simple queries
  const mysql = mod('mysql2/promise');
  const url = new URL(process.env.DATABASE_URL);
  const conn = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 4000,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1).split('?')[0],
    ssl: { rejectUnauthorized: true },
  });

  console.log('=== DATABASE CONNECTION: OK ===\n');

  console.log('--- Users ---');
  const [users] = await conn.execute('SELECT id, name, nickName, email FROM User LIMIT 10');
  for (const u of users) {
    console.log(`  ${u.id.substring(0,12)}... | ${u.nickName ?? u.name ?? '(no name)'} | ${u.email}`);
  }

  console.log('\n--- Sessions ---');
  const [sessions] = await conn.execute('SELECT s.sessionToken, s.expires, u.name, u.email FROM Session s JOIN User u ON s.userId = u.id ORDER BY s.expires DESC LIMIT 5');
  for (const s of sessions) {
    const expired = new Date(s.expires) < new Date();
    console.log(`  ${s.sessionToken.substring(0,30)}... | ${s.name} | ${s.email} | Expires: ${s.expires} ${expired ? '(EXPIRED)' : '(VALID)'}`);
  }

  console.log('\n--- Experts ---');
  const [experts] = await conn.execute(`
    SELECT e.id, e.gender, e.isPublished, e.onboardingStep, e.fishAudioModelId,
           e.avatarVideoUrl IS NOT NULL as hasAvatar,
           e.audioIntroUrl IS NOT NULL as hasAudio,
           e.avatarScript IS NOT NULL as hasScript,
           u.name, u.nickName
    FROM Expert e JOIN User u ON e.userId = u.id LIMIT 10
  `);
  for (const e of experts) {
    console.log(`  ${e.id.substring(0,12)}... | ${e.nickName ?? e.name} | Gender: ${e.gender ?? '(none)'} | Step: ${e.onboardingStep} | Published: ${!!e.isPublished} | Avatar: ${!!e.hasAvatar} | Audio: ${!!e.hasAudio} | Script: ${!!e.hasScript} | FishModel: ${e.fishAudioModelId ?? '(none)'}`);
  }

  console.log('\n--- Expert Domains ---');
  const [domains] = await conn.execute('SELECT ed.expertId, ed.domain FROM ExpertDomain ed LIMIT 20');
  for (const d of domains) {
    console.log(`  ${d.expertId.substring(0,12)}... | ${d.domain}`);
  }

  console.log('\n--- Bookings ---');
  const [bookings] = await conn.execute('SELECT id, status, expertId, userId FROM Booking LIMIT 5');
  console.log(`  Total: ${bookings.length} bookings`);
  for (const b of bookings) {
    console.log(`  ${b.id.substring(0,12)}... | Status: ${b.status} | Expert: ${b.expertId.substring(0,12)}... | User: ${b.userId.substring(0,12)}...`);
  }

  console.log('\n--- Reviews ---');
  const [reviews] = await conn.execute('SELECT id, rating, bookingId FROM Review LIMIT 5');
  console.log(`  Total: ${reviews.length} reviews`);

  console.log('\n--- Available Slots ---');
  const [slots] = await conn.execute('SELECT COUNT(*) as cnt FROM AvailableSlot');
  console.log(`  Total: ${slots[0].cnt} slots`);

  await conn.end();
}

main().catch(console.error);
