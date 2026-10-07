import type { PersonData, BrandData } from "./types";

/**
 * Dynamic fields. A template says {{title}} and each person's signature
 * gets their own job title. Custom directory attributes are {{custom.key}}.
 */

export interface FieldDef {
  key: string;
  label: string;
  sample: string;
}

export const PERSON_FIELDS: FieldDef[] = [
  { key: "name", label: "Full name", sample: "Lesedi Molefe" },
  { key: "firstName", label: "First name", sample: "Lesedi" },
  { key: "lastName", label: "Last name", sample: "Molefe" },
  { key: "title", label: "Job title", sample: "Head of Operations" },
  { key: "department", label: "Department", sample: "Operations" },
  { key: "email", label: "Email", sample: "lesedi@example.com" },
  { key: "phone", label: "Phone", sample: "+267 390 1234" },
  { key: "mobile", label: "Mobile", sample: "+267 71 234 567" },
];

export const COMPANY_FIELDS: FieldDef[] = [
  { key: "company", label: "Company", sample: "Kalahari Freight" },
  { key: "website", label: "Website", sample: "kalaharifreight.co.bw" },
  { key: "address", label: "Address", sample: "Plot 50369, Gaborone" },
];

export const FIELDS: FieldDef[] = [...PERSON_FIELDS, ...COMPANY_FIELDS];

const TOKEN = /\{\{\s*([a-zA-Z][\w.-]*)\s*\}\}/g;

/** The value of every field for one person and brand. Missing values are empty strings. */
export function fieldValues(person: PersonData, brand: BrandData): Record<string, string> {
  const values: Record<string, string> = {
    name: [person.firstName, person.lastName].filter(Boolean).join(" "),
    firstName: person.firstName,
    lastName: person.lastName,
    title: person.title,
    department: person.department,
    email: person.email,
    phone: person.phone,
    mobile: person.mobile,
    company: brand.company,
    website: brand.website,
    address: brand.address,
  };
  for (const [k, v] of Object.entries(person.custom)) values[`custom.${k}`] = v;
  return values;
}

/** Fills tokens in plain text. Unknown tokens become empty. */
export function fill(text: string, values: Record<string, string>): string {
  return text.replace(TOKEN, (_, key: string) => (values[key] ?? "").trim());
}

/**
 * Fills tokens line by line and drops a line whose tokens were all empty,
 * so a person with no mobile number doesn't get a stray "M:" line.
 */
export function fillLines(text: string, values: Record<string, string>): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const tokens = [...line.matchAll(TOKEN)];
    const filled = fill(line, values);
    if (tokens.length && tokens.every((t) => !(values[t[1]] ?? "").trim())) continue;
    if (!filled.trim() && line.trim()) continue;
    out.push(filled);
  }
  return out;
}

export function tokensIn(text: string): string[] {
  return [...text.matchAll(TOKEN)].map((m) => m[1]);
}

/** A believable person for previews before the directory has anyone in it. */
export const SAMPLE_PERSON: PersonData = {
  firstName: "Lesedi",
  lastName: "Molefe",
  email: "lesedi@example.com",
  title: "Head of Operations",
  department: "Operations",
  phone: "+267 390 1234",
  mobile: "+267 71 234 567",
  photo: null,
  custom: {},
};
