/**
 * The website's free writers: out-of-office replies and email
 * disclaimers. Plain functions, so the wording is tested and the page
 * stays simple.
 */

export type AwayReason = "leave" | "travel" | "conference" | "holiday" | "parental" | "unwell";

export const AWAY_REASONS: { key: AwayReason; label: string }[] = [
  { key: "leave", label: "Annual leave" },
  { key: "travel", label: "Travelling for work" },
  { key: "conference", label: "At a conference or training" },
  { key: "holiday", label: "Office closed for a holiday" },
  { key: "parental", label: "Parental leave" },
  { key: "unwell", label: "Off sick" },
];

export interface AwayInput {
  name: string;
  reason: AwayReason;
  /** The day they're back, as people would write it, for example "Monday 3 November". */
  back: string;
  /** Who to contact instead. */
  cover: string;
  coverEmail: string;
  /** A phone number for anything urgent. */
  urgent: string;
  company: string;
  tone: "warm" | "formal";
}

const AWAY_LINE: Record<AwayReason, { warm: string; formal: string }> = {
  leave: { warm: "I'm on leave", formal: "I am on annual leave" },
  travel: { warm: "I'm travelling for work with limited access to email", formal: "I am travelling on business with limited access to email" },
  conference: { warm: "I'm at a conference and checking email only now and then", formal: "I am attending a conference and will have limited access to email" },
  holiday: { warm: "Our offices are closed for the public holiday", formal: "Our offices are closed for the public holiday" },
  parental: { warm: "I'm on parental leave", formal: "I am on parental leave" },
  unwell: { warm: "I'm off sick", formal: "I am currently out of the office" },
};

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

/** An out-of-office reply that tells people when you're back and what to do in the meantime. */
export function outOfOffice(input: AwayInput): string {
  const name = clean(input.name);
  const back = clean(input.back);
  const cover = clean(input.cover);
  const coverEmail = clean(input.coverEmail);
  const urgent = clean(input.urgent);
  const company = clean(input.company);
  const warm = input.tone === "warm";
  const away = AWAY_LINE[input.reason][input.tone];

  const lines: string[] = [];
  lines.push(warm ? "Hello," : "Good day,");
  lines.push("");
  const intro = input.reason === "holiday" ? `${away}` : `Thank you for your email. ${away}`;
  lines.push(back ? `${intro} and back ${input.reason === "holiday" ? "open" : "in the office"} on ${back}.` : `${intro}.`);

  if (input.reason === "parental") {
    lines.push(warm ? "I won't be reading email while I'm away, so your message won't reach me until I'm back." : "I will not be reading email during this time.");
  } else if (input.reason === "travel" || input.reason === "conference") {
    lines.push(warm ? "I'll reply as soon as I can, though it may take a little longer than usual." : "I will respond as soon as possible, although replies may be delayed.");
  } else if (input.reason !== "holiday") {
    lines.push(warm ? "I'll reply when I'm back." : "I will respond on my return.");
  }

  if (cover) {
    const who = coverEmail ? `${cover} at ${coverEmail}` : cover;
    lines.push(warm ? `If it can't wait, ${who} is looking after things while I'm away and will be glad to help.` : `For anything that requires attention before then, please contact ${who}.`);
  }
  if (urgent) lines.push(warm ? `For something urgent, call ${urgent}.` : `For urgent matters, please call ${urgent}.`);

  lines.push("");
  lines.push(warm ? "Thanks," : "Kind regards,");
  if (name) lines.push(name);
  if (company) lines.push(company);
  return lines.join("\n");
}

export type DisclaimerPart = "confidential" | "contract" | "viruses" | "privacy" | "regulated";

export const DISCLAIMER_PARTS: { key: DisclaimerPart; label: string; hint: string }[] = [
  { key: "confidential", label: "Confidentiality", hint: "What to do if the email reached the wrong person" },
  { key: "contract", label: "No contract by email", hint: "Emails don't bind the company unless confirmed in writing" },
  { key: "viruses", label: "Viruses", hint: "Ask people to check attachments" },
  { key: "privacy", label: "Personal information", hint: "How you handle personal data in email" },
  { key: "regulated", label: "Regulated business", hint: "Your licence or registration line" },
];

export type Country = "BW" | "ZA" | "other";

export const COUNTRIES: { key: Country; label: string }[] = [
  { key: "BW", label: "Botswana" },
  { key: "ZA", label: "South Africa" },
  { key: "other", label: "Somewhere else" },
];

export interface DisclaimerInput {
  company: string;
  registration: string;
  country: Country;
  parts: DisclaimerPart[];
  /** For a regulated business, for example "Authorised financial services provider, FSP 12345". */
  licence: string;
}

const PRIVACY_LAW: Record<Country, string> = {
  BW: "the Botswana Data Protection Act",
  ZA: "the Protection of Personal Information Act (POPIA)",
  other: "the data protection law that applies to us",
};

const COUNTRY_NAME: Record<Country, string> = { BW: "Botswana", ZA: "South Africa", other: "" };

/** A short email disclaimer from the parts chosen. Short beats thorough here: long ones go unread. */
export function disclaimer(input: DisclaimerInput): string {
  const company = clean(input.company) || "The company";
  const out: string[] = [];
  if (input.parts.includes("confidential")) {
    out.push(
      "This email and any attachments are confidential and meant only for the person they are addressed to. If you received it by mistake, please tell the sender and delete it. Please don't copy it or share it.",
    );
  }
  if (input.parts.includes("contract")) {
    out.push(`Nothing in this email creates a binding agreement for ${company} unless it is confirmed in a signed document.`);
  }
  if (input.parts.includes("viruses")) {
    out.push("We check our email for viruses, but please check any attachment before you open it.");
  }
  if (input.parts.includes("privacy")) {
    out.push(`We handle personal information in line with ${PRIVACY_LAW[input.country]}.`);
  }
  if (input.parts.includes("regulated") && clean(input.licence)) {
    const licence = clean(input.licence).replace(/\.$/, "");
    out.push(`${licence.charAt(0).toUpperCase()}${licence.slice(1)}.`);
  }
  const reg = clean(input.registration);
  const where = COUNTRY_NAME[input.country];
  if (reg || where) {
    out.push(`${company}${where ? `, registered in ${where}` : ""}${reg ? `, company number ${reg}` : ""}.`);
  }
  return out.join(" ");
}
