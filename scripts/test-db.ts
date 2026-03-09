import { PrismaClient } from '../src/generated/prisma';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

async function main() {
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!, { ssl: { rejectUnauthorized: true } });
  const prisma = new PrismaClient({ adapter });

  console.log('--- Sessions ---');
  const sessions = await prisma.session.findMany({ include: { user: true }, take: 5 });
  for (const s of sessions) {
    console.log(`Session: ${s.sessionToken.substring(0,30)}... | User: ${s.user.name} | ${s.user.email} | Expires: ${s.expires.toISOString()}`);
  }

  console.log('\n--- Experts ---');
  const experts = await prisma.expert.findMany({ include: { user: true, domains: true }, take: 10 });
  for (const e of experts) {
    console.log(`Expert: ${e.id} | User: ${e.user.nickName ?? e.user.name} | Gender: ${e.gender ?? '(none)'} | Published: ${e.isPublished} | HasAvatar: ${!!e.avatarVideoUrl} | HasAudio: ${!!e.audioIntroUrl} | FishModel: ${e.fishAudioModelId ?? '(none)'} | Domains: ${e.domains.map(d => d.domain).join(', ')}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
