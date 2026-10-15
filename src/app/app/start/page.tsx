import { CircleCheck, Circle } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SignatureThumb } from "@/components/signatures/thumb";
import { SAMPLE_PERSON } from "@/lib/signature/fields";
import { renderSignature } from "@/lib/signature/render";
import { STARTERS } from "@/lib/signature/starters";
import { asTenant } from "@/server/db";
import { startState } from "@/server/onboarding/service";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { kitOptions, origin } from "@/server/signatures/studio-data";
import { PICKED_TEMPLATE_COOKIE } from "@/server/site";
import { quickStartAction } from "./actions";

export const metadata: Metadata = { title: "Get started" };

/** Four professional looks to choose from straight away; the full library is a click further. */
const PICKS = ["general-everyday", "general-personal", "consulting-advisor", "technology-product"];

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  const Icon = done ? CircleCheck : Circle;
  return (
    <Card>
      <div className="flex items-start gap-4">
        <Icon aria-hidden className={done ? "mt-0.5 size-6 shrink-0 text-positive" : "mt-0.5 size-6 shrink-0 text-border-strong"} />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <h2 className="text-headline text-ink">
            <span className="sr-only">{done ? "Done: " : "To do: "}</span>
            {n}. {title}
          </h2>
          {children}
        </div>
      </div>
    </Card>
  );
}

export default async function StartPage({ searchParams }: { searchParams: Promise<{ applied?: string }> }) {
  const applied = (await searchParams).applied;
  const { actor, organisation } = await requireMember();
  const s = await startState(organisation.id);
  const manage = can(actor, "manageTemplates");
  const kits = await asTenant(organisation.id, (tx) => kitOptions(tx, organisation.id));
  const o = origin();
  // A template picked on the website before signing up comes first.
  const pickedKey = (await cookies()).get(PICKED_TEMPLATE_COOKIE)?.value;
  const picked = STARTERS.find((x) => x.key === pickedKey);
  const picks = [picked, ...PICKS.map((k) => STARTERS.find((x) => x.key === k))].filter((x, i, all) => !!x && all.indexOf(x) === i).slice(0, 4) as typeof STARTERS;
  const shown = picks.length >= 2 ? picks : STARTERS.slice(0, 4);
  const peopleDone = s.people > 0;
  const signatureDone = s.published > 0 && s.rules > 0;
  const applying = s.gmailApplied + s.outlookApplied > 0 || s.addin;
  const live = !!s.firstSignatureAt;
  const liveAfter = s.firstSignatureAt ? Math.max(1, Math.round((s.firstSignatureAt.getTime() - (Date.now() - s.minutesSinceSignUp * 60_000)) / 60_000)) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={organisation.name} title="Get your first signature live" />
      <p className="-mt-2 text-body text-ink-muted">
        {live
          ? `Done. Your first signature went live ${liveAfter} ${liveAfter === 1 ? "minute" : "minutes"} after you signed up.`
          : `Four steps. Most small teams finish in under 20 minutes. You started ${s.minutesSinceSignUp < 1 ? "just now" : `${s.minutesSinceSignUp} ${s.minutesSinceSignUp === 1 ? "minute" : "minutes"} ago`}.`}
      </p>
      {applied ? (
        <Alert tone="positive">{applied === "everyone" ? "Published and given to everyone. Change who gets it any time from the signature." : "Published. Choose who gets it from the signature."}</Alert>
      ) : null}

      <Step n={1} done={peopleDone} title="Bring in your people">
        <p className="text-callout text-ink-muted">
          {s.connected
            ? `Connected to ${s.connected === "GOOGLE" ? "Google Workspace" : "Microsoft 365"}. ${s.people} ${s.people === 1 ? "person is" : "people are"} in your directory and stay up to date.`
            : peopleDone
              ? `${s.people} ${s.people === 1 ? "person is" : "people are"} in your directory.`
              : "Connect your directory so names, titles and phones fill in themselves, or add people yourself."}
        </p>
        {s.connected ? null : (
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/app/connections">{s.connectionPending ? "Finish connecting" : "Connect Google or Microsoft"}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/people">Add people or a spreadsheet</Link>
            </Button>
          </div>
        )}
      </Step>

      <Step n={2} done={signatureDone} title="Pick a signature">
        {signatureDone ? (
          <p className="text-callout text-ink-muted">
            You have {s.published} published {s.published === 1 ? "signature" : "signatures"}.{" "}
            <Link href="/app/signatures" className="font-semibold text-link hover:underline">
              Change it in the studio
            </Link>
          </p>
        ) : manage ? (
          <>
            <p className="text-callout text-ink-muted">
              Shown in your brand. One click publishes it for everyone; you can change anything later.{" "}
              {s.hasLogo ? null : (
                <>
                  <Link href="/app/brand" className="font-semibold text-link hover:underline">
                    Add your logo and colours first
                  </Link>{" "}
                  if you like.
                </>
              )}
            </p>
            <ul className="grid gap-4 md:grid-cols-2">
              {shown.map((st) => (
                <li key={st.key} className="flex flex-col gap-3 rounded-lg border border-border p-4">
                  <SignatureThumb html={renderSignature(st.doc, { brand: kits[0].brand, person: SAMPLE_PERSON, assets: {}, origin: o }).html} title={st.name} />
                  <form action={quickStartAction} className="flex items-center justify-between gap-3">
                    <span className="flex flex-col">
                      <span className="font-semibold text-ink">{st.name}</span>
                      {st === picked ? <span className="text-caption text-ink-muted">The one you picked on our website</span> : null}
                    </span>
                    <input type="hidden" name="starter" value={st.key} />
                    <Button type="submit" size="sm">
                      Use this
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
            <Link href="/app/signatures/new" className="text-callout font-semibold text-link hover:underline">
              See all templates, by industry
            </Link>
          </>
        ) : (
          <p className="text-callout text-ink-muted">Someone who manages templates picks this.</p>
        )}
      </Step>

      <Step n={3} done={applying} title="Put it in everyone's email">
        <ul className="flex flex-col gap-2 text-callout text-ink">
          <li>
            <strong>Gmail:</strong>{" "}
            {s.connected === "GOOGLE"
              ? s.gmailApplied
                ? `set for ${s.gmailApplied} ${s.gmailApplied === 1 ? "person" : "people"}, and kept up to date.`
                : "set for everyone automatically once a signature is published."
              : "connect Google Workspace and we set it for everyone."}
          </li>
          <li>
            <strong>Outlook:</strong>{" "}
            {s.addin ? (
              s.outlookApplied ? (
                `in use by ${s.outlookApplied} ${s.outlookApplied === 1 ? "person" : "people"}.`
              ) : (
                "the add-in is ready. It adds the signature as people write once your Microsoft 365 admin deploys it."
              )
            ) : (
              <>
                deploy the add-in once, from{" "}
                <Link href="/app/connections" className="font-semibold text-link hover:underline">
                  Connections
                </Link>
                , and the signature appears as people write.
              </>
            )}
          </li>
        </ul>
      </Step>

      <Step n={4} done={live} title="See it live">
        <p className="text-callout text-ink-muted">
          {live ? (
            <>
              Your signatures are live.{" "}
              <Link href="/app/coverage" className="font-semibold text-link hover:underline">
                See who has theirs
              </Link>
            </>
          ) : (
            "This ticks itself off when the first person has their signature in Gmail or Outlook. Send yourself an email to check."
          )}
        </p>
      </Step>
    </div>
  );
}
