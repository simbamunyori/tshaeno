/**
 * Which signature one person gets for one email. Pure, so the web app,
 * the worker and the Outlook add-in's endpoint all decide the same way.
 *
 * The most specific rule wins: a rule for the person beats one for a
 * group they're in, then their department, then their location, then
 * everyone. At the same level a rule for internal or external email
 * beats one for any email, and among equals the newest wins.
 */

export type Scope = "EVERYONE" | "LOCATION" | "DEPARTMENT" | "GROUP" | "PERSON";
export type Audience = "ANY" | "INTERNAL" | "EXTERNAL";

export const SCOPE_RANK: Record<Scope, number> = { PERSON: 5, GROUP: 4, DEPARTMENT: 3, LOCATION: 2, EVERYONE: 1 };

export interface Rule {
  templateId: string;
  scope: Scope;
  department: string | null;
  groupName: string | null;
  location: string | null;
  personId: string | null;
  forNew: boolean;
  forReply: boolean;
  audience: Audience;
  createdAt: Date;
}

export interface RulePerson {
  id: string;
  department: string;
  location?: string;
  groups?: string[];
}

export interface EmailContext {
  /** A new email, or a reply or forward. */
  compose: "new" | "reply";
  /** Everyone it is addressed to is inside the organisation, or not. */
  audience: "internal" | "external";
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

export function ruleCoversPerson(rule: Rule, person: RulePerson): boolean {
  switch (rule.scope) {
    case "EVERYONE":
      return true;
    case "PERSON":
      return rule.personId === person.id;
    case "DEPARTMENT":
      return !!norm(person.department) && norm(rule.department) === norm(person.department);
    case "LOCATION":
      return !!norm(person.location) && norm(rule.location) === norm(person.location);
    case "GROUP": {
      const g = norm(rule.groupName);
      return !!g && (person.groups ?? []).some((x) => norm(x) === g);
    }
  }
}

function ruleFitsEmail(rule: Rule, ctx: EmailContext): boolean {
  if (ctx.compose === "new" ? !rule.forNew : !rule.forReply) return false;
  return rule.audience === "ANY" || rule.audience.toLowerCase() === ctx.audience;
}

function order(a: Rule, b: Rule): number {
  return (
    SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope] ||
    Number(b.audience !== "ANY") - Number(a.audience !== "ANY") ||
    b.createdAt.getTime() - a.createdAt.getTime()
  );
}

/** The template for one email, or null when no rule covers it. */
export function signatureFor(person: RulePerson, rules: Rule[], ctx: EmailContext): string | null {
  return rules.filter((r) => ruleCoversPerson(r, person) && ruleFitsEmail(r, ctx)).sort(order)[0]?.templateId ?? null;
}

export interface ResolvedSignatures {
  /** The signature for new emails to people outside the organisation. */
  newEmail: string | null;
  /** The signature for replies and forwards to people outside the organisation. */
  reply: string | null;
  /** Every signature any rule gives this person, most specific first. */
  all: string[];
}

/**
 * A person's signatures for external email, which is what Gmail gets and
 * what the directory and coverage pages show.
 */
export function resolveAssignments(person: RulePerson, rules: Rule[]): ResolvedSignatures {
  const mine = rules.filter((r) => ruleCoversPerson(r, person)).sort(order);
  return {
    newEmail: signatureFor(person, rules, { compose: "new", audience: "external" }),
    reply: signatureFor(person, rules, { compose: "reply", audience: "external" }),
    all: [...new Set(mine.map((r) => r.templateId))],
  };
}

/** How a rule reads in a list: "Everyone in Finance, for new emails to people outside". */
export function describeRule(rule: Pick<Rule, "scope" | "department" | "groupName" | "location" | "forNew" | "forReply" | "audience">, personLabel?: string): {
  who: string;
  when: string;
} {
  const who =
    rule.scope === "EVERYONE"
      ? "Everyone"
      : rule.scope === "DEPARTMENT"
        ? `Everyone in ${rule.department}`
        : rule.scope === "GROUP"
          ? `Members of ${rule.groupName}`
          : rule.scope === "LOCATION"
            ? `Everyone at ${rule.location}`
            : (personLabel ?? "One person");
  const usage = rule.forNew && rule.forReply ? "new emails and replies" : rule.forNew ? "new emails" : "replies";
  const audience = rule.audience === "INTERNAL" ? " inside the organisation" : rule.audience === "EXTERNAL" ? " to people outside" : "";
  return { who, when: `for ${usage}${audience}` };
}
