/**
 * Email bodies. Plain words, one clear button, a text version of
 * everything. Colours follow brand/tokens.json; mail clients ignore CSS
 * variables, so the hex values are written out.
 */

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

const NAVY = "#0B1F3A";
const TEAL = "#0B7F78";
const MUTED = "#5A6472";
const SURFACE = "#F6F7F9";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(input: { heading: string; paragraphs: string[]; button: { label: string; url: string }; footnote: string }): Pick<Rendered, "html" | "text"> {
  const p = input.paragraphs.map((x) => `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${NAVY}">${escapeHtml(x)}</p>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:${SURFACE};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SURFACE};padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:12px;padding:32px">
<tr><td style="font-size:17px;font-weight:700;color:${NAVY};padding-bottom:24px">tshaeno<span style="color:#FF5B2E">.</span></td></tr>
<tr><td><h1 style="margin:0 0 16px;font-size:22px;line-height:28px;color:${NAVY}">${escapeHtml(input.heading)}</h1>${p}
<p style="margin:24px 0"><a href="${escapeHtml(input.button.url)}" style="display:inline-block;background:${TEAL};color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px">${escapeHtml(input.button.label)}</a></p>
<p style="margin:0;font-size:13px;line-height:20px;color:${MUTED}">${escapeHtml(input.footnote)}</p></td></tr>
</table></td></tr></table></body></html>`;
  const text = [input.heading, "", ...input.paragraphs.flatMap((x) => [x, ""]), `${input.button.label}: ${input.button.url}`, "", input.footnote].join("\n");
  return { html, text };
}

export function verifyEmail(input: { name: string; url: string }): Rendered {
  return {
    subject: "Confirm your email for Tshaeno",
    ...layout({
      heading: "Confirm your email",
      paragraphs: [`Hello ${input.name}.`, "Confirm this is your address so we can reach you about your account."],
      button: { label: "Confirm email", url: input.url },
      footnote: "The link works for three days. If you didn't sign up for Tshaeno, ignore this email.",
    }),
  };
}

export function invitation(input: { organisation: string; inviter: string; role: string; url: string }): Rendered {
  return {
    subject: `${input.inviter} invited you to ${input.organisation} on Tshaeno`,
    ...layout({
      heading: `Join ${input.organisation} on Tshaeno`,
      paragraphs: [
        `${input.inviter} has invited you to help manage email signatures for ${input.organisation}, as ${input.role}.`,
      ],
      button: { label: "Accept invitation", url: input.url },
      footnote: "The link works for seven days and only once. If you weren't expecting this, ignore it.",
    }),
  };
}
