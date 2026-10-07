import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { asTenant } from "@/server/db";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { liveRules, resolveAssignments } from "@/server/signatures/templates";
import { removeAssignmentAction } from "../../actions";
import { AddRuleForm } from "./add-rule-form";

export const metadata: Metadata = { title: "Who gets it" };

const USAGE = (r: { forNew: boolean; forReply: boolean }) => (r.forNew && r.forReply ? "new emails and replies" : r.forNew ? "new emails" : "replies");

export default async function WhoGetsItPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, organisation } = await requireMember();
  const data = await asTenant(organisation.id, async (tx) => {
    const template = await tx.signatureTemplate.findFirst({
      where: { id },
      include: { assignments: { orderBy: { createdAt: "asc" }, include: { person: { select: { firstName: true, lastName: true, email: true } } } } },
    });
    if (!template) return null;
    const people = await tx.person.findMany({ where: { active: true }, select: { id: true, firstName: true, lastName: true, email: true, department: true }, orderBy: { firstName: "asc" } });
    const rules = await liveRules(tx);
    let newCount = 0;
    let replyCount = 0;
    for (const p of people) {
      const r = resolveAssignments(p, rules);
      if (r.newEmail === id) newCount++;
      if (r.reply === id) replyCount++;
    }
    const departments = [...new Set(people.map((p) => p.department.trim()).filter(Boolean))].sort();
    return { template, people, departments, newCount, replyCount };
  });
  if (!data) notFound();
  const { template, people, departments, newCount, replyCount } = data;
  const manage = can(actor, "manageTemplates");
  const live = !!template.publishedVersionId && !template.archivedAt;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={<Link href={`/app/signatures/${template.id}`} className="hover:text-ink">{template.name}</Link>} title="Who gets it" />

      {!live ? (
        <Alert tone="info">
          {template.archivedAt ? "This signature is archived, so its rules don't apply." : "Publish this signature first. Its rules apply once a version is live."}
        </Alert>
      ) : (
        <Card>
          <p className="text-body text-ink">
            Right now <strong>{newCount}</strong> of {people.length} {people.length === 1 ? "person uses" : "people use"} it for new emails and <strong>{replyCount}</strong> for replies.
          </p>
          <p className="mt-1 text-callout text-ink-muted">
            When rules overlap, a rule for one person beats one for their department, which beats one for everyone. Among equals the newest wins. People can also pick any signature given to them.
          </p>
        </Card>
      )}

      <Card>
        <CardHeader title="Rules" />
        {template.assignments.length === 0 ? (
          <p className="text-callout text-ink-muted">Not given to anyone yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {template.assignments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="text-body text-ink">
                  {a.scope === "EVERYONE"
                    ? "Everyone"
                    : a.scope === "DEPARTMENT"
                      ? `Everyone in ${a.department}`
                      : `${a.person?.firstName ?? ""} ${a.person?.lastName ?? ""}`.trim() || a.person?.email}
                  <span className="text-ink-muted">, for {USAGE(a)}</span>
                </span>
                {manage ? (
                  <form action={removeAssignmentAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="templateId" value={template.id} />
                    <button className="text-callout font-semibold text-negative hover:underline">Remove</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {manage ? (
        <Card>
          <CardHeader title="Give it to people" />
          <AddRuleForm
            templateId={template.id}
            departments={departments}
            people={people.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}`.trim() + ` (${p.email})` }))}
          />
        </Card>
      ) : null}
    </div>
  );
}
