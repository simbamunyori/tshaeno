/**
 * Runs the Google and Microsoft stand-ins as one local HTTP server, for
 * trying the connection pages in a browser without real accounts:
 *
 *   npx tsx tests/fake-server.ts 4010 /tmp/sa.json
 *
 * then start the app with GOOGLE_SERVICE_ACCOUNT_KEY="$(cat /tmp/sa.json)"
 * and the GOOGLE_* and MICROSOFT_* endpoint settings pointing here.
 */
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { FakeGoogle, FakeMicrosoft, TEST_SA } from "./fakes";

const port = Number(process.argv[2] ?? 4010);
const saFile = process.argv[3];

const google = new FakeGoogle();
google.pageSize = 100;
google.users = [
  { id: "g1", primaryEmail: "lesedi@kalahari.example", name: { givenName: "Lesedi", familyName: "Molefe" }, organizations: [{ title: "Head of Operations", department: "Operations", location: "Gaborone", primary: true }], phones: [{ value: "+267 390 1234", type: "work" }] },
  { id: "g2", primaryEmail: "kabo@kalahari.example", name: { givenName: "Kabo", familyName: "Moremi" }, organizations: [{ title: "Fleet Supervisor", department: "Fleet", location: "Francistown", primary: true }] },
  { id: "g3", primaryEmail: "neo@kalahari.example", name: { givenName: "Neo", familyName: "Dube" }, organizations: [{ title: "Account Manager", department: "Sales", location: "Gaborone", primary: true }] },
  { id: "g4", primaryEmail: "mpho@kalahari.example", name: { givenName: "Mpho", familyName: "Sello" }, suspended: true },
  { id: "g5", primaryEmail: "boitumelo@kalahari.example", name: { givenName: "Boitumelo", familyName: "Kgosi" }, organizations: [{ title: "Accountant", department: "Finance", primary: true }] },
];
google.groups = [{ email: "sales@kalahari.example", name: "Sales Team", members: ["neo@kalahari.example", "kabo@kalahari.example"] }];
google.admins.add("admin@kalahari.example");
// Bounces one person's signature for good, so the coverage page has a problem to show.
const realFetch = google.fetch;
google.fetch = async (input, init) => {
  if (String(input).includes("sendAs/boitumelo")) return new Response(JSON.stringify({ error: { code: 400, message: "Invalid signature: too long" } }), { status: 400 });
  return realFetch(input, init);
};

const microsoft = new FakeMicrosoft();
microsoft.pageSize = 100;
microsoft.users = [{ id: "m1", mail: "thato@kalahari.example", givenName: "Thato", surname: "Ramotswe", jobTitle: "Director", department: "Leadership", officeLocation: "Gaborone", accountEnabled: true }];
// A new tenant each run, so consent works however often it is tried.
microsoft.signInTenant = randomUUID();

if (saFile) writeFileSync(saFile, JSON.stringify({ client_email: TEST_SA.clientEmail, client_id: TEST_SA.clientId, private_key: TEST_SA.privateKey }));

const HOSTS: Record<string, [string, FakeGoogle | FakeMicrosoft]> = {
  "/google/token": ["https://oauth2.test/token", google],
  "/google/admin": ["https://admin.test", google],
  "/google/gmail": ["https://gmail.test", google],
  "/ms/login": ["https://login.test", microsoft],
  "/ms/graph": ["https://graph.test", microsoft],
};

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const url = req.url ?? "/";
  const prefix = Object.keys(HOSTS).find((p) => url.startsWith(p));
  if (!prefix) {
    res.writeHead(404).end();
    return;
  }
  const [base, fake] = HOSTS[prefix];
  const target = prefix === "/google/token" ? base : base + url.slice(prefix.length);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  const reply = await fake.fetch(target, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks).toString() : undefined });
  const location = reply.headers.get("location");
  res.writeHead(reply.status, location ? { location } : { "content-type": "application/json" }).end(await reply.text());
}).listen(port, () => console.info(`Stand-ins listening on ${port}`));
