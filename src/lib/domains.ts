import { prisma } from "@/lib/prisma";

export function domainStrings(
  domains: { domain: string }[] | undefined | null
): string[] {
  return (domains ?? []).map((d) => d.domain);
}

export async function setExpertDomains(
  expertId: string,
  domains: string[]
): Promise<void> {
  await prisma.$transaction([
    prisma.expertDomain.deleteMany({ where: { expertId } }),
    ...domains.map((domain) =>
      prisma.expertDomain.create({ data: { expertId, domain } })
    ),
  ]);
}
