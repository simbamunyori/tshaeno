/** Solutions pages for each team that buys or runs Tshaeno. */

export interface TeamSolution {
  slug: string;
  label: string;
  headline: string;
  intro: string;
  /** Each one is shown beside a template, so a starter key comes with it. */
  rows: { title: string; text: string; starter: string; colour: string }[];
  questions: [string, string][];
}

export const TEAM_SOLUTIONS: TeamSolution[] = [
  {
    slug: "it",
    label: "IT",
    headline: "Set it up once. Then stop hearing about signatures.",
    intro:
      "Signature requests are small, constant and never quite finished. Tshaeno takes them off your list: details come from the directory you already run, signatures reach Gmail and Outlook without touching each machine, and every change is logged.",
    rows: [
      {
        title: "Connected to the directory you already keep",
        text: "Sign in with Google Workspace or Microsoft 365 and people come across with their titles, numbers, departments and offices. When HR updates someone's role, their signature changes on the next sync. Leavers drop off on their own.",
        starter: "legal-counsel",
        colour: "midnight",
      },
      {
        title: "Rules, not one-off requests",
        text: "Decide once who gets which signature: by department, office or group, a shorter one for replies, a different one for people outside the company. New starters land in the right rule on their first day.",
        starter: "technology-engineering",
        colour: "graphite",
      },
      {
        title: "Nothing to install on each computer",
        text: "Gmail signatures are set for the whole domain from our side. Outlook gets an add-in you deploy once from the Microsoft 365 admin centre, and it adds signatures in Outlook on Windows, Mac and the web.",
        starter: "logistics-operations",
        colour: "cobalt",
      },
    ],
    questions: [
      ["Does Tshaeno sit in our mail flow?", "No. We don't reroute or relay your email. Signatures are written into Gmail's own settings, and Outlook adds them through the add-in as people write."],
      ["What access do you ask for?", "Read access to your directory, and in Google Workspace, permission to set Gmail signatures. You approve it once, as an administrator, and you can revoke it whenever you like."],
      ["How is our data kept apart from other customers?", "Each organisation's records are separated by the database itself, with row-level security, so a mistake in our code still couldn't show one customer another's people."],
      ["Who can change signatures?", "Only the people you make owners or admins. Every change, publish and rule is recorded in an audit log you can read."],
    ],
  },
  {
    slug: "marketing",
    label: "Marketing",
    headline: "Your brand on every email, exactly as it was designed.",
    intro:
      "Your people send more email in a week than your newsletter sends in a year. Tshaeno makes every one of those emails carry the right logo, the right colours and, when you want it to, this month's campaign.",
    rows: [
      {
        title: "One brand kit, every signature",
        text: "Logo, colours, fonts and social links live in one place. Change the kit and every signature follows the same day.",
        starter: "creative-studio",
        colour: "oxblood",
      },
      {
        title: "Campaigns under every signature",
        text: "Put a graphic under everyone's signature for a launch, an event or an offer. Choose which teams carry it, set the dates, and it comes down on its own when the campaign ends.",
        starter: "hospitality-guest-relations",
        colour: "forest",
      },
      {
        title: "Know what people clicked",
        text: "See clicks by campaign and by department, so you can tell which teams send the most valuable email and which graphic worked.",
        starter: "retail-store",
        colour: "bronze",
      },
    ],
    questions: [
      ["Can we use our own designs?", "Yes. Upload your logo and graphics, build in the studio, or paste HTML from your designer. We check it in Outlook, Gmail and Apple Mail and tell you what to fix."],
      ["Can people change the design?", "They can add their own photo and social links if you allow it. The layout, colours and logo stay as you set them."],
      ["How big should a campaign graphic be?", "Around 600 pixels wide and as light as you can make it. Our guide on signature banners goes through sizes, links and alt text."],
    ],
  },
  {
    slug: "sales",
    label: "Sales",
    headline: "Every reply becomes a way to book the next meeting.",
    intro:
      "A good salesperson's signature does a little selling of its own. Tshaeno gives each rep a polished signature with their photo and a button to their own calendar, and lets you change the offer for everyone at once.",
    rows: [
      {
        title: "A booking button for each rep",
        text: "Add a button that opens each person's own calendar link, kept in a custom field, so clients can book time without a back and forth.",
        starter: "consulting-advisor",
        colour: "cobalt",
      },
      {
        title: "A different signature outside the company",
        text: "Show prospects and clients the full signature with the offer, and keep internal emails short and quiet.",
        starter: "finance-client-desk",
        colour: "midnight",
      },
      {
        title: "Offers that change with the quarter",
        text: "Point a graphic at this month's promotion for the sales team only, then see which reps' emails drove the clicks.",
        starter: "technology-product",
        colour: "graphite",
      },
    ],
    questions: [
      ["Can each rep have their own photo?", "Yes. People add their own photo and links from a simple page, inside the design you approve."],
      ["Does it work on phones?", "Gmail signatures go out from any device, because they live in Gmail itself. In Outlook, the add-in adds them wherever Outlook runs add-ins."],
    ],
  },
  {
    slug: "hr",
    label: "HR and leadership",
    headline: "Everyone looks like they belong to the same company.",
    intro:
      "Signatures say a lot about how a company is run. When they're consistent and correct, nobody notices. When they aren't, clients do. Tshaeno keeps them right without asking anyone to remember anything.",
    rows: [
      {
        title: "Right from the first day",
        text: "New starters get their signature as soon as they're in the directory, with the correct title and number. When people move roles, their signature moves with them.",
        starter: "general-everyday",
        colour: "midnight",
      },
      {
        title: "One disclaimer, worded once",
        text: "Your legal disclaimer is identical on every email, and you change it in one place when the wording changes.",
        starter: "legal-partner",
        colour: "graphite",
      },
      {
        title: "A personal touch, within the lines",
        text: "People can add their own photo and LinkedIn link from a simple page, without changing the design you approved.",
        starter: "general-personal",
        colour: "oxblood",
      },
    ],
    questions: [
      ["Can we use it for internal announcements?", "Yes. A campaign can run for people inside the company only, for example for an awards evening or a wellness week."],
      ["Who sees our staff list?", "The admins you choose. Tshaeno support staff can open your organisation to help, and every time they do, it is recorded."],
    ],
  },
];

export function teamSolution(slug: string): TeamSolution | undefined {
  return TEAM_SOLUTIONS.find((t) => t.slug === slug);
}
