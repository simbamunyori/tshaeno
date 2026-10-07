import type { Tx } from "@/server/db";

const distinct = (xs: (string | null | undefined)[]) =>
  [...new Map(xs.map((x) => (x ?? "").trim()).filter(Boolean).map((x) => [x.toLowerCase(), x])).values()].sort((a, b) => a.localeCompare(b));

/** The departments, offices and groups in the directory, to suggest as campaign targets. */
export async function targetOptions(tx: Tx) {
  const people = await tx.person.findMany({ where: { active: true }, select: { department: true, location: true, groups: true } });
  return {
    DEPARTMENT: distinct(people.map((p) => p.department)),
    LOCATION: distinct(people.map((p) => p.location)),
    GROUP: distinct(people.flatMap((p) => p.groups)),
  };
}
