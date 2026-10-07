import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SignatureThumb } from "@/components/signatures/thumb";
import { asTenant } from "@/server/db";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { origin } from "@/server/signatures/studio-data";
import { liveRules, renderForPerson, resolveAssignments } from "@/server/signatures/templates";
import { removePersonAction } from "../actions";
import { PersonForm, PhotoForm } from "../people-forms";
import { CopyButton } from "./copy-button";

export const metadata: Metadata = { title: "Person" };

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  const { id } = await params;
  const added = (await searchParams).added === "1";
  const { actor, organisation } = await requireMember();
  const o = origin();
  const data = await asTenant(organisation.id, async (tx) => {
    const person = await tx.person.findFirst({ where: { id } });
    if (!person) return null;
    const fields = await tx.customField.findMany({ orderBy: { createdAt: "asc" }, select: { key: true, label: true } });
    const departments = (await tx.person.findMany({ distinct: ["department"], select: { department: true }, where: { department: { not: "" } } })).map((d) => d.department).sort();
    const resolved = resolveAssignments(person, await liveRules(tx));
    const names = new Map((await tx.signatureTemplate.findMany({ where: { id: { in: resolved.all } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]));
    const signatures = [];
    for (const tid of resolved.all) {
      const r = await renderForPerson(tx, organisation.id, tid, person.id, o);
      if (r) signatures.push({ id: tid, name: names.get(tid) ?? "Signature", html: r.html, text: r.text, forNew: resolved.newEmail === tid, forReply: resolved.reply === tid });
    }
    return { person, fields, departments, signatures };
  });
  if (!data) notFound();
  const { person, fields, departments, signatures } = data;
  const manage = can(actor, "manageDirectory");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={<Link href="/app/people" className="hover:text-ink">People</Link>} title={`${person.firstName} ${person.lastName}`.trim()} />
      {added ? <Alert tone="positive">Added to the directory.</Alert> : null}

      <Card>
        <CardHeader title="Their signatures">From the rules on each signature. People can choose between these when they write.</CardHeader>
        {signatures.length === 0 ? (
          <p className="text-callout text-ink-muted">
            No signature is given to {person.firstName} yet. Open a signature and choose <strong>Who gets it</strong>.
          </p>
        ) : (
          <ul className="flex flex-col gap-6">
            {signatures.map((s) => (
              <li key={s.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-col">
                    <Link href={`/app/signatures/${s.id}`} className="font-semibold text-ink hover:underline">
                      {s.name}
                    </Link>
                    <span className="text-callout text-ink-muted">
                      {s.forNew && s.forReply ? "Used for new emails and replies" : s.forNew ? "Used for new emails" : s.forReply ? "Used for replies" : "Available to choose"}
                    </span>
                  </span>
                  <CopyButton html={s.html} text={s.text} />
                </div>
                <SignatureThumb html={s.html} title={s.name} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Details" />
        <PersonForm
          person={{ ...person, custom: Object.fromEntries(Object.entries((person.custom ?? {}) as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Record<string, string> }}
          customFields={fields}
          departments={departments}
          readOnly={!manage}
        />
      </Card>

      {manage ? (
        <>
          <Card>
            <CardHeader title="Photo">Shown in signatures that include a photo.</CardHeader>
            <PhotoForm id={person.id} hasPhoto={!!person.photoAssetId} />
          </Card>
          <form action={removePersonAction}>
            <input type="hidden" name="id" value={person.id} />
            <button className="text-callout font-semibold text-negative hover:underline">Remove {person.firstName} from the directory</button>
          </form>
        </>
      ) : null}
    </div>
  );
}
