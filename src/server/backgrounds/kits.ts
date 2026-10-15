import type { Tx } from "@/server/db";
import { ensureDefaultKit, toBrandData } from "@/server/signatures/brand";

/** The brand kits a background can use, default first, with relative image links so the browser can draw them. */
export async function kitOptions(tx: Tx, organisationId: string) {
  await ensureDefaultKit(tx, organisationId);
  const kits = await tx.brandKit.findMany({ include: { logo: { select: { id: true, contentType: true, width: true, height: true } } }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  return kits.map((k) => {
    const b = toBrandData(k, "");
    return { id: k.id, name: k.name, company: b.company, logoUrl: b.logo?.url ?? null, colours: [b.colours.primary, b.colours.secondary, b.colours.text] };
  });
}

/** People to show a background with: active, by name. */
export async function peopleOptions(tx: Tx) {
  const people = await tx.person.findMany({ where: { active: true }, select: { id: true, firstName: true, lastName: true, title: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], take: 2000 });
  return people.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`.trim(), title: p.title }));
}
