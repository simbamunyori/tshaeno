import type { Industry } from "@/lib/signature/starters";

export interface IndustrySolution {
  industry: Industry;
  slug: string;
  headline: string;
  intro: string;
  needs: { title: string; text: string }[];
  scenario: string;
}

export const INDUSTRY_SOLUTIONS: IndustrySolution[] = [
  {
    industry: "General",
    slug: "small-business",
    headline: "Look like an established firm from your very first email",
    intro:
      "Small teams send a great deal of email and rarely have time to think about signatures. Tshaeno gives everyone the same signature, filled in from Google Workspace or Microsoft 365, so a new hire looks like part of the business on day one. Grow from five people to fifty and nothing about the process has to change.",
    needs: [
      {
        title: "One signature, set once",
        text: "Pick a template, add your logo and colours, and every mailbox picks it up. Gmail signatures are set from the server, and Outlook receives them through an add-in you deploy once.",
      },
      {
        title: "Details that keep themselves current",
        text: "Names, titles and phone numbers come from your directory or a spreadsheet. When someone changes role, their signature follows without anyone opening a settings page.",
      },
      {
        title: "A banner when you have news",
        text: "Schedule a graphic under everyone's signature for a launch or a seasonal offer, choose the dates, and see how many people clicked.",
      },
    ],
    scenario:
      "Picture a twelve-person accounting and payroll bureau in Gaborone that has just opened a second desk in Francistown. The owner sets up one brand kit, adds the Francistown office to the directory, and both teams send email that plainly comes from the same firm. When filing season arrives, a dated banner reminding clients of deadlines appears under every signature and comes down when the dates end.",
  },
  {
    industry: "Legal",
    slug: "legal",
    headline: "Signatures that respect partners, practice areas and client confidentiality",
    intro:
      "A firm's name travels into every matter by email, and the signature is often the first thing opposing counsel and new clients read closely. Tshaeno keeps partner and associate titles accurate and your confidentiality notice word for word identical across every mailbox. Fee earners never have to touch it.",
    needs: [
      {
        title: "Titles and practice groups from the directory",
        text: "Partner, senior associate or candidate attorney, each person's title and practice group come from Google Workspace or Microsoft 365, so the signature always matches the letterhead.",
      },
      {
        title: "One confidentiality notice, everywhere",
        text: "Your firm decides the wording of its disclaimer. Tshaeno makes sure that exact wording appears on every external email, so nobody shortens it or pastes in an old version.",
      },
      {
        title: "Quieter replies inside long threads",
        text: "Use a full signature on new emails and a short one on replies, so a forty-message exchange on a matter does not repeat the same logo forty times. Email between colleagues can leave the notice off entirely.",
      },
    ],
    scenario:
      "Say a commercial firm with offices in Gaborone and Johannesburg runs its corporate and litigation teams under different rules. Litigators carry their direct lines and the standard notice, while the corporate team adds a banner for a client briefing in the weeks before it takes place. If anyone later asks who changed the disclaimer and when, the audit log has the answer.",
  },
  {
    industry: "Finance",
    slug: "finance",
    headline: "Controlled, consistent signatures for banks, insurers and investment houses",
    intro:
      "Clients of a financial institution read a signature as a clue to whether an email is genuine. Tshaeno gives every branch, adviser and relationship manager the same approved design, with disclosure wording that cannot drift. Administrators use two-step sign-in, every change lands in the audit log, and your data is kept separate from every other organisation's.",
    needs: [
      {
        title: "Disclosures that stay as written",
        text: "Your compliance team owns the wording. Tshaeno holds it in one place and applies it identically to every external email, so it cannot be edited at the desk.",
      },
      {
        title: "A layout clients learn to recognise",
        text: "When every message from the institution looks the same, an email in the wrong format is more likely to give a client pause. Staff cannot swap in their own fonts or an outdated logo.",
      },
      {
        title: "Branch and team detail by rule",
        text: "A branch consultant, a private banker and the treasury desk can each carry the right contact details and call to action, set by office, department or group.",
      },
    ],
    scenario:
      "Picture a lender with branches in Gaborone, Francistown and Maun launching a new home loan. Marketing schedules a banner for the retail branches only, for six weeks, while corporate banking keeps its plain signature. When the campaign ends, the click counts show which branches generated the most interest.",
  },
  {
    industry: "Healthcare",
    slug: "healthcare",
    headline: "Practice signatures that book appointments and set clear expectations",
    intro:
      "Patients email practices to book, to reschedule and, often, to ask questions that belong in a consultation. Tshaeno puts a booking button and the right practice details under every reply, alongside a standard notice that email is not the place for medical advice. Reception, nursing staff and doctors each get a signature that suits how they speak to patients.",
    needs: [
      {
        title: "A booking button on every email",
        text: "Add a 'Book an appointment' button that links to your booking page or phone line, so a patient has an obvious next step instead of writing back again.",
      },
      {
        title: "A clear word on medical advice",
        text: "A standard notice can explain that email is not monitored for emergencies and does not replace a consultation. It reads the same from the front desk to the specialist.",
      },
      {
        title: "The right site, the right hours",
        text: "Practices with several rooms set signatures by office, so a patient writing to the Maun branch sees Maun's address and number rather than head office.",
      },
    ],
    scenario:
      "Say a group of family practices has rooms in Gaborone and Francistown. Each reception team replies with its own address, hours and booking button, and visiting specialists' signatures show the days they consult. In flu season, a scheduled banner about vaccination appointments runs under patient-facing email at both sites.",
  },
  {
    industry: "Real estate",
    slug: "real-estate",
    headline: "Turn every agent's email into a route back to your listings",
    intro:
      "Agents live in their inboxes, and buyers, sellers and tenants judge an agency by every reply. Tshaeno gives each agent a branded signature with their own photo and links, and a button that takes people straight to current listings. The agency keeps control of the design, and agents keep the personal touch their clients expect.",
    needs: [
      {
        title: "Agent photos within the brand",
        text: "Agents upload their own headshot and personal links, while the layout, colours and logo stay exactly as the agency approved them.",
      },
      {
        title: "Buttons that lead to property",
        text: "A 'View listings' or 'Book a viewing' button sits under every email, pointing to the agent's profile or the agency's property pages.",
      },
      {
        title: "Banners for show days and developments",
        text: "Schedule a graphic for an open day or a new development, show it only to the sales team for that area, and see how many recipients clicked through.",
      },
    ],
    scenario:
      "Picture an agency with sales and rentals desks in Gaborone and a growing office in Francistown. Rentals signatures point tenants to available units, sales signatures point buyers to listings, and a banner for a new townhouse development in Phakalane runs for a month under the Gaborone sales team only.",
  },
  {
    industry: "Technology",
    slug: "technology",
    headline: "Signatures your IT team sets up once and rarely revisits",
    intro:
      "Technology companies run on Google Workspace or Microsoft 365, sometimes both, and signatures tend to be a chore nobody owns. Tshaeno connects to your directory, sets Gmail signatures from the server and reaches Outlook through an add-in deployed once. Marketing then looks after the design and campaigns without raising tickets.",
    needs: [
      {
        title: "Directory-driven from day one",
        text: "Names, titles, departments and phone numbers come straight from Google Workspace or Microsoft 365. Onboarding a new engineer gives them a signature with no separate step.",
      },
      {
        title: "Product news under customer email",
        text: "Run a release or webinar banner under customer-facing teams for a set period, keep it off internal threads, and measure clicks for each campaign.",
      },
      {
        title: "Security you can explain to a customer",
        text: "Administrators sign in with two-step verification, every change is recorded in the audit log, and each organisation's data is kept separate in the database.",
      },
    ],
    scenario:
      "Say a software company in Gaborone sells to banks across Southern Africa and has a sales office in Johannesburg. Support engineers get a short signature with the help desk link, account executives get a 'Book a demo' button, and a launch banner runs for two weeks under external sales email only. The coverage page shows at a glance which mailboxes are not yet carrying the signature.",
  },
  {
    industry: "Education",
    slug: "education",
    headline: "One clear voice for every school office, from admissions to the bursar",
    intro:
      "Schools, colleges and universities email parents, students, applicants and staff from dozens of offices. Tshaeno gives each office the right signature under one brand, so a parent always knows whether they are hearing from admissions, the bursary or a class teacher. Open days and enrolment deadlines can run as banners in the weeks they matter.",
    needs: [
      {
        title: "Signatures by office and role",
        text: "Rules set signatures by department or group, so teaching staff, admissions and the bursary each show the contact details parents actually need.",
      },
      {
        title: "Banners that follow the academic year",
        text: "Schedule an open day, an application deadline or a fees reminder for the weeks it applies, and only for the teams who write to the families concerned.",
      },
      {
        title: "A lighter signature for colleagues",
        text: "Staff writing to one another get a short signature. Parents and students see the full version with the school's details and links.",
      },
    ],
    scenario:
      "Picture a private school group with campuses in Gaborone and Francistown. Admissions staff carry an 'Apply now' button during the enrolment window, the bursary's signature shows its own address and office hours, and a banner for the end-of-year concert runs for a fortnight under every teacher's external email.",
  },
  {
    industry: "Hospitality",
    slug: "hospitality",
    headline: "Signatures that turn every guest reply into the next booking",
    intro:
      "Lodges, hotels and tour operators answer a constant stream of enquiries, confirmations and special requests, many from guests overseas. Tshaeno gives every reservations agent and manager a branded signature with a booking button, the right property's details and the current offer underneath. Guests meet the same standard of care in an email that they will find on arrival.",
    needs: [
      {
        title: "A booking button under every reply",
        text: "Add 'Book your stay' or 'Check availability', so a guest reading the answer to their question can move straight to booking.",
      },
      {
        title: "Detail for each property",
        text: "Groups with several camps or hotels set signatures by office, so each property shows its own address and phone number within the group's design.",
      },
      {
        title: "Seasonal offers by date",
        text: "Run a green season rate or a festive offer as a banner for the dates it applies, then compare clicks across properties.",
      },
    ],
    scenario:
      "Say a safari operator runs its reservations office in Maun and lodges in the Okavango Delta. Reservations staff reply with a 'Check availability' button and a green season banner from November to March, while lodge managers' signatures carry transfer details and the lodge's contact number. Email between Maun and the lodges stays short and plain.",
  },
  {
    industry: "Construction",
    slug: "construction",
    headline: "Clear signatures for site teams, tender submissions and head office",
    intro:
      "Construction firms email clients, consultants, subcontractors and suppliers from site offices and head office alike, often from a phone in a site vehicle. Tshaeno gives every project manager, quantity surveyor and site agent a signature with the right contact details and the company's registration information. The tender team presents the same face as the site, and nobody designs their own.",
    needs: [
      {
        title: "Site and head office by rule",
        text: "Set signatures by office or group, so site staff show the project office number and address and head office shows the main switchboard.",
      },
      {
        title: "Registration details kept current",
        text: "Registration numbers and any accreditation marks you are entitled to show sit in one template and change everywhere at once. No tender goes out with last year's details.",
      },
      {
        title: "Safety messages under every email",
        text: "Run a site safety reminder as a banner under staff email for the period you choose, and for the teams you choose.",
      },
    ],
    scenario:
      "Picture a contractor based in Gaborone with a road project near Francistown and a school build in Maun. Each site team's signatures show the project office number, the estimating team keeps a short signature for tender correspondence, and a banner for the company's safety week runs under every email for five working days.",
  },
  {
    industry: "Consulting",
    slug: "consulting",
    headline: "Signatures as considered as the advice your consultants give",
    intro:
      "Consultants sell expertise, and clients notice whether every email from a firm looks as though it came from the same firm. Tshaeno gives partners, managers and analysts one approved signature, with room for their own photo and profile links. New research, briefings and events can run underneath for the clients who should see them.",
    needs: [
      {
        title: "Room for the individual",
        text: "People add their own photo and links, such as a professional profile, inside the approved layout. Titles and service lines come from the directory.",
      },
      {
        title: "Insight under client email",
        text: "Schedule a banner for a new report or a breakfast briefing, show it only to the service line that owns it, and count the clicks.",
      },
      {
        title: "A meeting button for senior people",
        text: "Partners and directors can carry a 'Book a meeting' button, so a client's reply turns into a diary entry rather than another round of email.",
      },
    ],
    scenario:
      "Say an advisory firm in Gaborone with a team in Johannesburg is publishing its annual review of the mining sector. For three weeks the banner runs under the natural resources team's external email only, while the tax practice promotes its budget briefing instead. Replies to clients use a shorter signature, so long threads stay readable.",
  },
  {
    industry: "Retail",
    slug: "retail",
    headline: "Put your latest promotion under every customer email you send",
    intro:
      "Retailers email customers, suppliers, landlords and franchisees, and one signature rarely suits all of them. Tshaeno sets signatures by store, department or group, keeps the brand identical in every branch, and lets marketing schedule promotions under the emails customers actually read.",
    needs: [
      {
        title: "Promotions on a calendar",
        text: "Schedule a month-end sale, a back-to-school campaign or a store opening as a banner, set the dates, and see which campaigns people click.",
      },
      {
        title: "Store details by branch",
        text: "Each store manager's signature shows the right address and phone number, filled in from the directory or a spreadsheet.",
      },
      {
        title: "A plainer signature for suppliers",
        text: "Buying and procurement can keep a simple signature for supplier email, while customer service carries promotions and a 'Shop online' button.",
      },
    ],
    scenario:
      "Picture a homeware chain with stores in Gaborone, Francistown and Jwaneng and a buying office in Johannesburg. Customer service runs a banner for the Black Friday weekend that comes down when the dates end, and buyers writing to suppliers never see it. Each store manager's signature shows their own branch.",
  },
  {
    industry: "Non-profit",
    slug: "non-profit",
    headline: "Signatures that keep donors, partners and volunteers close to your work",
    intro:
      "Most non-profits have no marketing department, yet every email to a donor, partner or volunteer is a chance to show what the organisation does. Tshaeno gives staff and programme officers one signature under one brand, with a donate or volunteer button and appeal banners when you need them. Directory details keep it current as people join and move on.",
    needs: [
      {
        title: "A clear way to give",
        text: "Add a 'Donate' or 'Volunteer with us' button under external email, and keep it off internal threads where it would only be clutter.",
      },
      {
        title: "Programmes and appeals by team",
        text: "Field teams can carry a programme banner while fundraising runs an appeal, each scheduled for the dates you set.",
      },
      {
        title: "Registration details in one place",
        text: "Your registration number and any statements you choose to include sit in the disclaimer and appear identically on every email.",
      },
    ],
    scenario:
      "Say a youth development organisation works from Gaborone with field staff in Maun and Francistown. Programme officers' signatures show their district office, fundraising runs a year-end appeal banner for December only, and the click counts tell the board how many recipients went on to the appeal page.",
  },
  {
    industry: "Public sector",
    slug: "public-sector",
    headline: "Clear, citizen-facing signatures across every ministry, department and office",
    intro:
      "Government bodies and parastatals email the public from many departments, each with its own contact points. Tshaeno keeps one official design across all of them, while each department shows the address, phone line and service hours citizens need. Changes are made centrally and recorded in the audit log, so they are deliberate and traceable.",
    needs: [
      {
        title: "Many departments, one standard",
        text: "Rules set signatures by department, office and group, so a regional office and a head office unit each carry the right details under the same emblem and colours.",
      },
      {
        title: "Contact details people can use",
        text: "Show the public enquiries line, office address and service hours rather than an internal extension, with a button to the relevant online service where one exists.",
      },
      {
        title: "Official notices, kept official",
        text: "Disclaimers and standard notices are written once and appear identically on every external email, with each change to them recorded.",
      },
    ],
    scenario:
      "Picture a land administration authority with its head office in Gaborone and service centres in Francistown, Maun and Jwaneng. Each centre replies with its own address and hours, a banner about a new online application service runs under public-facing email for three months, and correspondence between departments carries a short internal signature.",
  },
  {
    industry: "Logistics",
    slug: "logistics",
    headline: "Freight and logistics signatures with the right depot on every email",
    intro:
      "Logistics businesses email customers, carriers and clearing agents from operations desks that move quickly. Tshaeno gives every desk a signature with the right depot, the right after-hours number and a link to tracking, all under one brand. When offices or routes change, signatures change with the directory.",
    needs: [
      {
        title: "Depot and desk detail by rule",
        text: "Operations staff at each depot show their own branch and phone line, set by office or group, while account managers carry their direct numbers.",
      },
      {
        title: "A tracking or quote button",
        text: "Add 'Track a shipment' or 'Request a quote', so a customer has an obvious next step from any email they receive.",
      },
      {
        title: "Compact signatures on busy threads",
        text: "Replies in long operational threads get a short signature, so delivery details stay at the top of the conversation rather than buried under logos.",
      },
    ],
    scenario:
      "Say a freight forwarder runs operations from Gaborone, a depot in Francistown and a desk in Johannesburg that handles cross-border loads. Each desk's signature shows its own after-hours number, sales carry a 'Request a quote' button, and a banner about a new cross-border route runs under customer-facing email for the month of the launch.",
  },
  {
    industry: "Creative",
    slug: "creative",
    headline: "Signatures as well designed as the work your studio sends",
    intro:
      "Agencies and studios are judged on taste, and a clumsy signature undercuts a good pitch. Tshaeno lets you build a signature that carries your brand's type and colour, then holds everyone to it. Your latest work or award can sit underneath for exactly as long as you want it seen.",
    needs: [
      {
        title: "Brand kit, kept exact",
        text: "Your logo, colours, fonts and social links live in one brand kit, so nobody improvises their own version in a mail client.",
      },
      {
        title: "Personal touches within the design",
        text: "People add their own photo and portfolio links, and the layout the studio approved stays intact.",
      },
      {
        title: "The work under the email",
        text: "Schedule a banner for a new campaign, a case study or an event, for the dates you choose and the teams who pitch.",
      },
    ],
    scenario:
      "Picture a design and advertising studio in Gaborone with a small team in Johannesburg. New business runs a banner linking to its latest case study for the month after launch, producers keep a plain signature for supplier and printer email, and the click counts show how many people went through to the work.",
  },
  {
    industry: "Mining and energy",
    slug: "mining-and-energy",
    headline: "One signature standard from the mine site to head office",
    intro:
      "Mining and energy companies email regulators, contractors, communities and investors from remote sites, regional offices and head office. Tshaeno gives each location the right contact details under one corporate design, and puts safety messages under every email when they need to be seen. Signatures are managed centrally, so a remote site does not need someone locally to look after them.",
    needs: [
      {
        title: "Site and head office by rule",
        text: "Staff at a mine or plant show the site address and switchboard number, while head office shows corporate contacts, all set by office or group.",
      },
      {
        title: "Safety messages that reach everyone",
        text: "Run a safety campaign or a planned shutdown notice as a banner under staff email for the dates it applies, at one site or across the group.",
      },
      {
        title: "Identical notices on external email",
        text: "Corporate disclaimers and confidentiality wording stay the same on every site and contractor-facing mailbox, and each change is recorded in the audit log.",
      },
    ],
    scenario:
      "Picture a mining group with head office in Gaborone, an operation near Jwaneng and a procurement office in Johannesburg. Jwaneng staff send email with the site's address and contact line, procurement keeps a plain signature for supplier correspondence, and a banner for the group's annual safety week runs under every email for the week it happens.",
  },
];

export function industrySolution(slug: string): IndustrySolution | undefined {
  return INDUSTRY_SOLUTIONS.find((s) => s.slug === slug);
}
