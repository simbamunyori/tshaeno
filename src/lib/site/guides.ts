export interface GuideSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

export interface Guide {
  slug: string;
  title: string;
  summary: string;
  category: "Getting started" | "Design" | "Compliance" | "Everyday email";
  minutes: number;
  sections: GuideSection[];
}

export const GUIDES: Guide[] = [
  {
    slug: "email-signature-best-practices",
    title: "What belongs in a business email signature",
    summary:
      "A practical checklist for signatures that look right on a phone, survive dark mode and tell people how to reach you, without turning every email into a brochure.",
    category: "Design",
    minutes: 7,
    sections: [
      {
        heading: "Start with what the reader needs",
        paragraphs: [
          "A signature has one job. It tells the person reading your email who you are, which organisation you work for and how to reach you. Everything else is optional, and most of it gets in the way.",
          "A good test is to imagine a client in Francistown reading your reply on a phone between meetings. They want your name, your role, and a number they can tap. If they have to scroll past a logo, three social icons, a quote and a disclaimer to find that number, the signature is working against you.",
        ],
        list: [
          "Full name, written the way people should address you",
          "Job title, kept short",
          "Organisation name, and department if it helps people route queries",
          "One or two phone numbers in international format",
          "Website address",
          "Physical or postal address only if clients actually need it",
        ],
      },
      {
        heading: "Keep it to four to six lines",
        paragraphs: [
          "Most strong signatures fit in four to six lines of text, plus a logo. Once you go past seven or eight, people stop reading and the signature starts to look like a footer that came with the email software.",
          "Combine items onto one line where it reads naturally. Phone and website can share a line, separated by a vertical bar or a middle dot. The address can go on one line rather than four.",
          "Leave out things that change often or that nobody uses. Fax numbers are mostly gone. A personal motto or an inspirational quote rarely lands well with a supplier who is chasing an invoice.",
        ],
      },
      {
        heading: "Write phone numbers so anyone can dial them",
        paragraphs: [
          "Your emails travel further than you think. A number written as 71 234 567 works for someone in Gaborone, but a partner in Johannesburg or London has to guess the country code. Use the international format with a plus sign, and group the digits so they are easy to read aloud.",
          "Label the numbers if you show more than one, using a short prefix such as T for office and M for mobile. On phones, most mail apps will turn a well formatted number into a tap to call link. You can also make it a tel: link yourself so it works everywhere.",
        ],
        list: [
          "Botswana mobile: +267 71 234 567",
          "Botswana landline: +267 395 1234",
          "South Africa: +27 11 555 0123",
          "Avoid brackets and leading zeros once you include the country code, so not +27 (0)11 555 0123",
        ],
      },
      {
        heading: "Images, logos and sizes",
        paragraphs: [
          "Use one logo, not several. Keep it modest, around 150 to 200 pixels wide on screen and no more than about 60 to 80 pixels high. Export it at twice that size so it stays sharp on high resolution screens, then set the display width in the signature.",
          "Host images on a web server and link to them, rather than embedding them as attachments. Embedded images often show up as paperclip attachments, get stripped by some mail systems and make every reply heavier. Keep each image file small, ideally under 50 KB for a logo.",
          "Assume some recipients will block images by default. Add alt text to the logo, such as the organisation name, so the signature still makes sense as plain text. Never put your phone number or address inside an image, because people cannot copy it and screen readers cannot read it.",
          "Social icons are fine if your organisation genuinely uses those channels. Two or three small icons are plenty. Link them to accounts that are active, not ones last updated in 2019.",
        ],
      },
      {
        heading: "Make it readable on a phone",
        paragraphs: [
          "A large share of business email is read on mobile, so design for a narrow screen first. Avoid wide layouts with the logo in one column and text in two more. On a phone those columns either squash or force sideways scrolling.",
          "A simple stacked layout, or a logo on the left with text on the right that collapses gracefully, works best. Use a font size of at least 12 to 14 pixels for the main text and stick to web safe fonts such as Arial, Helvetica, Verdana or Georgia. Custom brand fonts usually fall back to something else on the recipient's side anyway.",
        ],
      },
      {
        heading: "Plan for dark mode",
        paragraphs: [
          "Outlook, Gmail and Apple Mail all have dark modes, and each one treats colours a little differently. Some invert text colours, some leave images alone, some do both. A logo with black text on a transparent background can vanish on a dark grey screen.",
          "The safest approach is to give logos a solid light background, or a subtle light outline, so they read on both light and dark. Avoid pure black text in the signature itself; a very dark grey tends to survive inversion better. Test by sending the signature to yourself and opening it on a phone with dark mode switched on.",
        ],
      },
      {
        heading: "What to leave out",
        paragraphs: [
          "Most signature problems come from adding things, not missing them. If you are unsure whether something belongs, it probably does not.",
        ],
        list: [
          "Long legal disclaimers in the signature block. Keep the disclaimer separate and short.",
          "Personal email addresses or private mobile numbers for staff who do not want them shared",
          "Animated GIFs, which distract and often do not animate in Outlook",
          "Several different colours and fonts in one block",
          "Images containing text that people need to read or copy",
          "Background images, which many clients ignore or render badly",
        ],
      },
    ],
  },
  {
    slug: "microsoft-365-signatures",
    title: "How signatures work in Outlook and Microsoft 365",
    summary:
      "Why signatures in Outlook vary from one device to the next, what roaming signatures changed, where transport rule disclaimers fall short, and how an add-in approach fixes it.",
    category: "Getting started",
    minutes: 8,
    sections: [
      {
        heading: "Signatures used to live on each device",
        paragraphs: [
          "For most of Outlook's history, a signature was a set of files on the computer where it was created. In classic Outlook for Windows they sit in a Signatures folder inside the user's profile. Outlook on the web had its own separate signature. The Outlook mobile apps had another.",
          "This is why the same person can send three different signatures in one day. The desktop version has the new logo, the web version still has last year's title, and the phone just says \"Sent from Outlook for iOS\". Nobody did anything wrong; the signatures were simply never connected.",
          "Every new laptop, reinstall or profile rebuild means the signature has to be set up again. In a firm of 20 people that is a nuisance. In an organisation of 500 spread across Gaborone, Francistown and Maun, it means the brand drifts within months.",
        ],
      },
      {
        heading: "What roaming signatures changed",
        paragraphs: [
          "Microsoft has moved signatures into the mailbox itself, a feature usually called roaming or cloud signatures. With it, a signature created in Outlook on the web or the new Outlook for Windows is stored with the mailbox and follows the user to other supported versions of Outlook.",
          "This helps individuals, but it does not give an administrator central control. Each user still creates and edits their own signature. There is no built-in way to say \"everyone in Finance gets this layout with their own name and number filled in\". Older Outlook builds and some mobile apps may also behave differently, so you still see gaps.",
          "Some organisations that ran signature scripts against the old file based setup found roaming signatures overwrote their work. Microsoft provides an organisation level setting in Exchange Online PowerShell to postpone roaming signatures for that reason. If you rely on a script today, check how it interacts with roaming before you assume it still works.",
        ],
      },
      {
        heading: "Transport rule disclaimers and their limits",
        paragraphs: [
          "Exchange Online lets an administrator create a mail flow rule, sometimes called a transport rule, with an action to apply a disclaimer. In the Exchange admin centre this sits under mail flow rules. The rule can append HTML to messages as they pass through the server, and it can pull in some directory attributes such as display name, title and phone number.",
          "It sounds like central signatures solved. In practice there are trade-offs that most offices notice quickly.",
        ],
        list: [
          "The text is added to the end of the message body. In a reply, the body includes the quoted earlier messages, so the signature lands at the very bottom of the thread instead of under the new reply.",
          "The sender never sees it while writing, and it does not appear in their Sent Items, which confuses people.",
          "Each reply in a long thread can stack another copy at the bottom unless the rule has exceptions set carefully.",
          "Encrypted or digitally signed messages cannot be changed in transit, so the rule's fallback action decides whether they are wrapped, skipped or rejected.",
          "Layout control is limited, and testing changes means sending real mail through the rule.",
        ],
      },
      {
        heading: "How an Outlook add-in approach works",
        paragraphs: [
          "Modern Outlook supports add-ins that run when a user starts a new message, reply or forward. An add-in built for this can insert the correct signature into the compose window at that moment, directly under where the person is typing.",
          "Because the signature goes in while the email is being written, the sender sees exactly what the recipient will see. It sits in the right place in replies, it appears in Sent Items, and it works with encrypted mail because nothing is changed after the message is sent.",
          "The signature itself is built from a template and the user's directory details. When someone's title changes in Microsoft 365, the next email they write picks up the new title without anyone touching their Outlook.",
        ],
      },
      {
        heading: "Deploying it once for the whole organisation",
        paragraphs: [
          "Outlook add-ins can be deployed centrally by a Microsoft 365 administrator through Integrated apps in the Microsoft 365 admin centre. You can assign the add-in to everyone, to specific groups, or to a small pilot group first. Once assigned, it appears in users' Outlook without them installing anything, although it can take several hours to reach everyone.",
          "Tshaeno works this way. Your administrator deploys the Tshaeno add-in once from the Microsoft 365 admin centre, and Tshaeno reads each person's name, title, department and phone numbers from Microsoft 365. Templates are managed in one place, so a new logo or a campaign banner reaches every user at the same time.",
        ],
      },
      {
        heading: "Get the directory right first",
        paragraphs: [
          "Any central signature system is only as good as the data behind it. Before you switch on, spend an hour reviewing user records in the Microsoft 365 admin centre or Microsoft Entra ID.",
        ],
        list: [
          "Job titles written consistently, for example \"Finance Manager\" rather than a mix of \"Fin Mgr\" and \"Manager, Finance\"",
          "Phone numbers in international format, such as +267 395 1234",
          "Department and office location filled in, if your templates use them",
          "Shared mailboxes and service accounts excluded from signature rules where they should not carry a personal signature",
        ],
      },
    ],
  },
  {
    slug: "google-workspace-signatures",
    title: "How Gmail signatures work in Google Workspace",
    summary:
      "Where Gmail stores signatures, why the admin footer setting is not a real signature tool, and how central management sets every user's signature from the Google directory.",
    category: "Getting started",
    minutes: 6,
    sections: [
      {
        heading: "Each user sets their own signature",
        paragraphs: [
          "In Gmail on the web, a user creates a signature in Settings, under See all settings and then the General tab. Gmail allows several named signatures and lets the user pick a default for new emails and another for replies and forwards.",
          "The signature is stored with the account, so it shows up on any computer where the person uses Gmail in a browser. That is better than the old Outlook situation, but it is still the user's own setting. Each person types their own details, chooses their own formatting and decides whether to bother updating it.",
          "The Gmail mobile apps add another wrinkle. They have a separate mobile signature setting that is plain text only. If it is empty, the app may use the web signature, but behaviour varies, so many people end up with no signature or a bare name on phone replies.",
        ],
      },
      {
        heading: "The admin footer setting, and why it falls short",
        paragraphs: [
          "Google Workspace administrators have a setting called Append footer, found in the Admin console under the Gmail compliance settings. It adds the same text or simple HTML to outgoing messages for an organisational unit.",
          "It works well for one thing: a short, identical line on every message, such as a company registration number or a brief confidentiality note. It is not a signature tool.",
        ],
        list: [
          "Everyone in the organisational unit gets exactly the same footer. There are no per-user fields for name, title or phone number.",
          "It is added when the message leaves, so the sender does not see it while writing.",
          "It sits at the bottom of the message, below quoted text in replies, rather than under the new reply.",
          "Formatting options are basic, and images need careful handling.",
        ],
      },
      {
        heading: "How central management works",
        paragraphs: [
          "Google provides the Gmail API, which allows an authorised application to read and update each user's Gmail settings, including the signature on their send-as addresses. An administrator grants that access once, using domain-wide delegation for a service account with a narrow Gmail settings scope.",
          "With that in place, a signature system can write a properly formatted signature into every user's Gmail settings. The result is the same as if each person had pasted it in themselves, except it is consistent and nobody had to do it by hand. The signature appears in the compose window, in the right place in replies, and in Sent Mail.",
          "The personal details come from the Google directory through the Admin SDK. Name, job title, department, phone numbers and address fields on each user record can all feed the template. Tshaeno uses this approach for Google Workspace, so when you update a title in the Admin console the signature follows on the next sync.",
        ],
      },
      {
        heading: "Limits to know about",
        paragraphs: [
          "Gmail caps signature length at around 10,000 characters, which is plenty for a normal signature but can catch out heavily styled HTML. Keep the markup lean.",
          "Images must be hosted at a public web address. Gmail does not store uploaded signature images in a way an API can reference, so logos and banners should live on a reliable server.",
          "If users are still allowed to edit their own signatures, they can overwrite the managed one. Most organisations either ask staff not to edit, or resync on a schedule so any change is corrected within a day.",
        ],
      },
      {
        heading: "Before you switch on",
        paragraphs: [
          "Tidy the directory first. Open the Users list in the Admin console and check that job titles, departments and phone numbers are filled in and consistent. A template cannot fix a missing title.",
          "Agree what happens with mobile. If your staff send a lot of mail from the Gmail app, decide whether you want a short plain text mobile signature as well, and tell people how to set it.",
        ],
        list: [
          "Check user records for titles and international phone numbers, such as +267 71 234 567",
          "Decide which organisational units get which template",
          "Exclude shared or group addresses that should not carry a personal signature",
          "Run a pilot with five or ten people before rolling out to everyone",
        ],
      },
    ],
  },
  {
    slug: "email-disclaimers",
    title: "Email disclaimers: what they can and cannot do",
    summary:
      "What a disclaimer is actually for, why it is not a legal shield, how data protection law in Botswana and South Africa changes the picture, and wording that stays short.",
    category: "Compliance",
    minutes: 6,
    sections: [
      {
        heading: "What a disclaimer is for",
        paragraphs: [
          "An email disclaimer is a short note at the bottom of a message. Most organisations use one to say that the email is meant for the named recipient, that it may contain confidential information, and what to do if it arrived by mistake.",
          "It can also carry information you are required or expected to show, such as the registered company name and number, or a line about how you handle personal information. For regulated businesses, it can point to where clients find formal terms.",
          "This guide is general information, not legal advice. The right wording depends on your sector and the countries you deal with, so check with your own lawyer before you settle on it.",
        ],
      },
      {
        heading: "What it can and cannot do legally",
        paragraphs: [
          "A disclaimer is a notice. It is not a contract the recipient has agreed to. A line at the foot of an email saying the reader must delete it, or that the sender accepts no liability, does not on its own bind someone who never agreed to those terms. Courts in different countries have treated such notices in different ways, and the general view among practitioners is that they carry limited weight.",
          "What a disclaimer can do is show that you treated the information as confidential and told people what to do if it went astray. That can be useful context if there is ever a dispute. It can also reduce confusion, for example by making clear that an email is not a formal offer.",
          "It cannot undo a mistake. If someone sends a client's file to the wrong address, the disclaimer does not make that acceptable. Good habits matter far more: checking the To field, using the right distribution lists and not forwarding long threads without reading them.",
        ],
      },
      {
        heading: "Data protection in Botswana and South Africa",
        paragraphs: [
          "Botswana's Data Protection Act and South Africa's Protection of Personal Information Act, usually called POPIA, both set rules for how organisations collect, use and protect personal information. Email is one of the main ways personal information moves around a business, so these laws are relevant to how your staff use it.",
          "A disclaimer does not make you compliant with either law. Compliance comes from how you actually handle data: who can see it, how long you keep it, how you secure it and what you do when something goes wrong. A disclaimer can point people to your privacy notice or tell them how to contact your information officer, which is a sensible use of the space.",
          "If you work across borders, you may also have obligations in other countries. Your lawyer or compliance adviser is the right person to confirm what applies to you.",
        ],
      },
      {
        heading: "Keep it short",
        paragraphs: [
          "Long disclaimers are a habit carried over from the early days of email. Nobody reads 200 words of legal text at the bottom of a message about a meeting time, and on a phone it can be longer than the email itself.",
          "Aim for two to four sentences. Put it below the signature in a smaller, grey font so it is clearly separate. If you need to say more, link to a page on your website with the full text.",
          "Consider whether every email needs it. Many organisations apply the disclaimer to external mail only, and leave internal messages clean.",
        ],
      },
      {
        heading: "Examples of good wording",
        paragraphs: [
          "These are starting points to discuss with your lawyer, not approved text. Adjust names and links to suit.",
        ],
        list: [
          "General: \"This email and any attachments are intended for the named recipient and may be confidential. If you received it in error, please tell the sender and delete it. Thank you.\"",
          "With privacy link: \"This message may contain personal or confidential information. If it reached you by mistake, please let us know and delete it. Read how we handle personal information at example.co.bw/privacy.\"",
          "Company details: \"Kgale Logistics (Pty) Ltd, registered in Botswana, company number BW00001234567. Plot 1234, Gaborone.\"",
          "Not an offer: \"Prices and terms in this email are indicative and not a binding offer unless confirmed in a signed quotation.\"",
        ],
      },
      {
        heading: "Managing it centrally",
        paragraphs: [
          "Disclaimers are one of the clearest cases for central management. When the wording is changed after a legal review, you want it changed on every account the same day, not left to individual staff.",
          "With Tshaeno you can set a disclaimer once and choose which groups it applies to, such as external mail only or a specific subsidiary. Keep a record of when wording changed and who approved it, so you can answer questions later.",
        ],
      },
    ],
  },
  {
    slug: "out-of-office-messages",
    title: "Out-of-office replies that actually help",
    summary:
      "How to write an automatic reply that tells people when you are back, who can help in the meantime and what to do if it is urgent, without giving away more than you should.",
    category: "Everyday email",
    minutes: 5,
    sections: [
      {
        heading: "What a good reply does",
        paragraphs: [
          "An out-of-office reply has a narrow job. It tells the sender that you will not see their message for a while, when you will, and who can help before then. If it does those three things clearly, it has done its work.",
          "Write it the way you would speak to a client on the phone. Keep it plain and brief. People read automatic replies quickly, often on a phone, so put the most useful information first.",
        ],
      },
      {
        heading: "What to include",
        paragraphs: [
          "Give the date you will be back and reading email, not just the date you leave. If you return on a Monday but will be catching up all day, say you will reply from Tuesday. It manages expectations honestly.",
        ],
        list: [
          "The date you return, written in full, such as Monday 3 November",
          "Whether you will be checking email at all while away",
          "A named colleague for general queries, with their email address",
          "A route for urgent matters, such as a team inbox or main switchboard number in international format",
          "A note on whether the message will be forwarded, so people know if they need to resend",
        ],
      },
      {
        heading: "What not to include",
        paragraphs: [
          "Automatic replies go to anyone who emails you, including people you have never met and senders of spam. Treat the reply as public.",
          "Do not say where you are travelling, which hotel you are in, or that your home will be empty. Criminals use this kind of detail for scams aimed at your colleagues, such as fake urgent payment requests that claim to be from you while you are \"unreachable\". \"I am out of the office\" is enough.",
          "Avoid giving out your personal mobile number unless you truly want calls from anyone. If you must be reachable, route urgent calls through a colleague or the office line instead.",
          "Consider setting a separate, shorter reply for external senders. Both Outlook automatic replies and the Gmail out-of-office responder let you limit or vary replies for people outside your organisation.",
        ],
      },
      {
        heading: "Example: annual leave",
        paragraphs: [
          "Thank you for your email. I am on leave until Friday 14 November and will not be checking messages. For anything about current orders, please contact Kagiso Molefe at kagiso.molefe@example.co.bw. For urgent matters, call our Gaborone office on +267 395 1234. I will reply when I am back.",
        ],
      },
      {
        heading: "Example: conference or training",
        paragraphs: [
          "Thank you for your message. I am attending a conference until Thursday 6 November with limited access to email. I will reply by Friday. If your query cannot wait, please email our support team at support@example.co.za or call +27 11 555 0123.",
        ],
      },
      {
        heading: "Example: public holidays and office closures",
        paragraphs: [
          "For a whole-office closure, such as the Botswana Day holidays at the end of September or the break between Christmas and New Year, set a shared message for everyone rather than relying on each person to write their own.",
          "Our offices are closed for the Botswana Day public holidays and reopen on Thursday 2 October. We will respond to your message then. For urgent support during the closure, please call +267 71 234 567.",
          "With central signature management such as Tshaeno, you can schedule a closure banner or note to appear on everyone's emails in the days before a holiday, so clients know in advance.",
        ],
      },
      {
        heading: "Small habits that help",
        paragraphs: [
          "Set the reply before your last afternoon, not on your way out the door. Most mail systems let you choose start and end times, so the reply switches itself off and you do not keep sending it after you return.",
          "Tell the colleague you name that you have named them. It sounds obvious, but many people find out only when the queries start arriving.",
        ],
      },
    ],
  },
  {
    slug: "signature-banners",
    title: "Using signature banners for campaigns",
    summary:
      "How to design a banner under your email signature that people notice and click: sizes, file weight, one clear message, alt text, scheduling and measuring results.",
    category: "Design",
    minutes: 6,
    sections: [
      {
        heading: "Why banners work",
        paragraphs: [
          "Your staff send thousands of emails a month to clients, suppliers and partners. Those emails are already opened and read. A small banner under the signature puts a message in front of people who know you, at no extra cost per send.",
          "Typical uses include an upcoming event, a new branch opening in Francistown, a product launch, an award, a customer survey or a notice about holiday closing times. The banner works best when it is relevant to the person reading it and changes often enough that people still notice it.",
        ],
      },
      {
        heading: "Size and file weight",
        paragraphs: [
          "Keep banners no wider than about 600 pixels on screen. That fits comfortably in most desktop email layouts and scales down on phones. A height of 100 to 150 pixels is usually enough; taller banners start to dominate the email.",
          "Export the image at twice the display size, for example 1200 by 240 pixels, then set it to display at 600 by 120. That keeps it sharp on high resolution screens. Compress it so the file stays small, ideally under 100 KB. JPG suits photographs, PNG suits flat colours and text.",
          "Host the banner on a web server and link to it rather than attaching it. Attached images make every reply heavier and often appear as attachments in the recipient's inbox.",
        ],
      },
      {
        heading: "One message per banner",
        paragraphs: [
          "A banner is seen for a second or two. It can carry one idea and one action. If you try to promote the new branch, the webinar and the loyalty scheme in one image, people will take in none of them.",
          "Use a short headline, a few words of supporting text at most, and a clear call to action such as \"Register\", \"Book a visit\" or \"Read more\". Make the text large enough to read on a phone. If you have to squint at it on your own screen, it is too small.",
          "Match the colours and fonts to the rest of your brand so it looks like part of the email, not an advert that slipped in.",
        ],
      },
      {
        heading: "Links and alt text",
        paragraphs: [
          "Link the whole banner to a specific page, not your home page. If the banner promotes a breakfast seminar in Gaborone, the link should go straight to the registration form.",
          "Add alt text that says what the banner says, for example \"Join our tax update breakfast, Gaborone, 20 November. Register now.\" Many recipients block images until they choose to load them, and screen readers rely on the alt text. A banner with no alt text is invisible to both.",
        ],
      },
      {
        heading: "Scheduling and taking it down",
        paragraphs: [
          "Every banner should have an end date before it goes live. Nothing looks worse than an invitation to an event that happened three weeks ago. Set the start and end dates when you set up the campaign, and put a reminder in someone's calendar as a backup.",
          "Consider who should see it. A banner about a retail promotion may not belong on emails from your legal or HR teams. Most signature tools, Tshaeno included, let you target banners at particular departments or groups and schedule them to switch on and off automatically.",
          "Rotate banners every few weeks. Regular contacts stop seeing a banner once it has been there for a month or two.",
        ],
      },
      {
        heading: "Measuring clicks",
        paragraphs: [
          "Add tracking parameters to the banner link so your web analytics can show visits that came from email signatures. UTM parameters are the usual way, for example utm_source=email-signature and utm_campaign=tax-breakfast. Use the same naming every time so results are easy to compare.",
          "Look at clicks and, more usefully, what happened next: registrations, enquiries or downloads. Expect modest click numbers. A signature banner is a steady background presence, not an email campaign, and it should be judged on that basis.",
        ],
      },
    ],
  },
  {
    slug: "branded-meeting-backgrounds",
    title: "Branded backgrounds for Zoom, Teams and Google Meet",
    summary:
      "How to design a meeting background that looks professional on camera, with the right size, a clear middle and readable name details, plus how staff set it up in each app.",
    category: "Design",
    minutes: 6,
    sections: [
      {
        heading: "Why bother with a branded background",
        paragraphs: [
          "Video calls are now a normal part of meeting clients, from a quick catch-up with a supplier in Johannesburg to a board presentation. A consistent background makes your team look like one organisation, hides a cluttered spare room, and can show each person's name and title so new contacts remember who they spoke to.",
          "It is the video equivalent of an email signature. The same rules apply: keep it simple, keep it consistent and make the useful information easy to read.",
        ],
      },
      {
        heading: "Size and format",
        paragraphs: [
          "Design at 1920 by 1080 pixels, which is a 16:9 ratio. Zoom, Microsoft Teams and Google Meet all handle this size well, and it matches most laptop cameras. Smaller images look blurry when stretched.",
          "Save as JPG or PNG. Keep the file size reasonable, ideally under about 1 MB, so it uploads quickly and does not slow down older laptops. Avoid video backgrounds for everyday use, as they use more processing power and can make the person look choppy.",
        ],
      },
      {
        heading: "Keep the middle clear",
        paragraphs: [
          "The person sits in the middle of the frame and covers most of it. Anything you put there will be hidden behind their head and shoulders, or worse, flicker around the edges as they move.",
          "Put the logo in a top corner, usually the top left or top right, at a modest size. Put the person's name and title in the other top corner or along the upper part of one side. Leave the lower middle and centre plain or softly textured.",
          "Remember that people sit at different heights and distances from the camera. Check your design with someone tall sitting close to their screen and someone short sitting further back.",
        ],
      },
      {
        heading: "Name, title and contrast",
        paragraphs: [
          "Name and title are the most useful things on the background. Keep them short, for example \"Lesedi Tau, Head of Operations\". Leave off phone numbers and email addresses; people cannot copy text from a video feed, and the details are already in the meeting invitation.",
          "Use strong contrast between text and background, such as white text on a dark brand colour, or dark text on a light, plain area. Video compression softens fine detail, so avoid thin fonts and small text. A heading size of 40 to 60 pixels at 1920 wide is a reasonable starting point.",
          "Choose a background that does not clash with skin tones or common clothing colours, and avoid busy patterns. Mid-tone or slightly muted colours usually look better on camera than very bright ones.",
        ],
      },
      {
        heading: "The mirror effect",
        paragraphs: [
          "Most meeting apps mirror your own preview so it feels like looking in a mirror. That means the text on your background looks reversed to you, even though everyone else sees it the right way round.",
          "Staff often think the image is broken and flip it themselves, which makes it backwards for everyone else. Tell people in advance. Zoom and Teams have an option to turn off mirroring of your own video if it bothers them.",
        ],
      },
      {
        heading: "How people set them in each app",
        paragraphs: [
          "Menu names change from time to time, so these are general steps. Send staff the image file and a short note with the steps for the app your organisation uses.",
        ],
        list: [
          "Zoom: open the desktop app settings, go to Background and Effects, choose the virtual backgrounds section and use the plus icon to add your image. You can also change it during a meeting from the arrow next to the video button.",
          "Microsoft Teams: before joining a meeting, open the background or video effects options on the join screen, choose Add new and upload the image. During a meeting, open the More menu and look for video effects and backgrounds. Organisations with Teams Premium can also publish backgrounds centrally for everyone.",
          "Google Meet: on the screen before you join, or during a call, select the option to apply visual effects, go to Backgrounds and use the upload option to add your image. Meet backgrounds are set per browser or device, so people may need to add it again on a new computer.",
        ],
      },
      {
        heading: "Rolling it out",
        paragraphs: [
          "Create a template with placeholders for name and title, then export one image per person, or ask a designer to set up a simple process for new starters. Keep the master files somewhere the office manager can find them when someone changes role.",
          "Use the same logo files, colours and fonts as your email signatures so the two look like they belong together. If you already manage signatures centrally with Tshaeno, the same brand assets are a sensible starting point for the background design.",
        ],
      },
    ],
  },
];

export function guide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
