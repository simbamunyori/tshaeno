/**
 * A single number for how well signatures are working, for small teams
 * who want a glance rather than a report, with the few things that would
 * raise it most.
 */

export interface HealthInput {
  /** Active people in the directory. */
  people: number;
  /** People whose signature is in Gmail or Outlook. */
  covered: number;
  /** People whose signature failed to apply. */
  problems: number;
  /** People no rule covers, or with no way to get a signature. */
  missing: number;
  /** Signature updates in the last 30 days that worked and that failed. */
  applied: number;
  failed: number;
  /** A directory is connected, and it synced in the last day. */
  connected: boolean;
  syncedRecently: boolean;
  /** Brand check findings that are warnings. */
  brandWarnings: number;
}

export interface Health {
  score: number;
  grade: "good" | "fair" | "poor";
  tips: string[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function healthScore(i: HealthInput): Health {
  if (i.people === 0) return { score: 0, grade: "poor", tips: ["Add your people, or connect Google Workspace or Microsoft 365 to bring them in."] };
  const coverage = Math.min(1, i.covered / i.people);
  const success = i.applied + i.failed === 0 ? 1 : i.applied / (i.applied + i.failed);
  const directory = i.connected ? (i.syncedRecently ? 1 : 0.5) : 0;
  const brand = Math.max(0, 1 - i.brandWarnings * 0.25);
  const score = Math.round(60 * coverage + 20 * success + 10 * directory + 10 * brand);

  const tips: { weight: number; text: string }[] = [];
  if (i.missing > 0) tips.push({ weight: (60 * i.missing) / i.people, text: `${plural(i.missing, "person has", "people have")} no signature yet. The Coverage page says why for each.` });
  if (i.problems > 0) tips.push({ weight: (60 * i.problems) / i.people + 5, text: `${plural(i.problems, "signature")} couldn't be applied. The Coverage page shows what went wrong.` });
  if (!i.connected) tips.push({ weight: 10, text: "Connect Google Workspace or Microsoft 365, so new starters get their signature on their own." });
  else if (!i.syncedRecently) tips.push({ weight: 5, text: "Your directory hasn't synced in the last day. Check it on the Connections page." });
  if (i.brandWarnings > 0) tips.push({ weight: 10 - 10 * brand + 1, text: `Fix ${plural(i.brandWarnings, "brand issue")} listed below, so every signature looks the same.` });
  return {
    score,
    grade: score >= 85 ? "good" : score >= 60 ? "fair" : "poor",
    tips: tips
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((t) => t.text),
  };
}
