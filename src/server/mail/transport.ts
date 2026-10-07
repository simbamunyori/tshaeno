import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/server/env";

export interface Message {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let transporter: Transporter | null | undefined;

function transport(): Transporter | null {
  if (transporter === undefined) {
    const url = env().SMTP_URL;
    transporter = url ? nodemailer.createTransport(url) : null;
  }
  return transporter;
}

export class MailNotConfiguredError extends Error {
  constructor() {
    super("Outgoing mail is not set up. Set SMTP_URL.");
    this.name = "MailNotConfiguredError";
  }
}

/**
 * Sends one message. Without SMTP_URL, development prints the message to
 * the log so its links can be followed; production refuses, so sign-in
 * links never end up in a log.
 */
export async function send(message: Message): Promise<void> {
  const t = transport();
  if (!t) {
    if (env().NODE_ENV === "production") throw new MailNotConfiguredError();
    console.info(`\n── Email (not sent: SMTP_URL is not set) ──\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`);
    return;
  }
  await t.sendMail({ from: env().MAIL_FROM, ...message });
}
