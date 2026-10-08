/**
 * A small CSV reader (RFC 4180): quoted fields, doubled quotes, commas,
 * semicolons or tabs, and line breaks inside quotes. Enough for a
 * directory export from Excel, Google Sheets or an HR system.
 */

export function detectDelimiter(firstLine: string): string {
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text.split(/\r?\n/, 1)[0] ?? "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** Header names people actually use, mapped to directory fields. */
const ALIASES: Record<string, string> = {
  email: "email",
  "e-mail": "email",
  emailaddress: "email",
  mail: "email",
  primaryemail: "email",
  userprincipalname: "email",
  firstname: "firstName",
  givenname: "firstName",
  first: "firstName",
  forename: "firstName",
  lastname: "lastName",
  surname: "lastName",
  familyname: "lastName",
  last: "lastName",
  name: "name",
  fullname: "name",
  displayname: "name",
  title: "title",
  jobtitle: "title",
  position: "title",
  role: "title",
  department: "department",
  dept: "department",
  team: "department",
  office: "location",
  location: "location",
  officelocation: "location",
  city: "location",
  phone: "phone",
  telephone: "phone",
  officephone: "phone",
  workphone: "phone",
  businessphone: "phone",
  mobile: "mobile",
  mobilephone: "mobile",
  cell: "mobile",
  cellphone: "mobile",
};

export function headerKey(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

/** Which directory field each column fills; null for columns we don't use. */
export function mapHeaders(headers: string[], customKeys: string[] = []): (string | null)[] {
  const custom = new Map(customKeys.map((k) => [headerKey(k), k]));
  return headers.map((h) => {
    const k = headerKey(h);
    if (ALIASES[k]) return ALIASES[k];
    const c = custom.get(k);
    return c ? `custom.${c}` : null;
  });
}
