import { escapeHtml } from "./style";
import type { Rendered } from "./render";

/**
 * The small "Signature by Tshaeno" line under signatures on the free
 * plan. Quiet grey text in its own row, so it never changes the layout
 * of the signature above it.
 */
export function withBadge(r: Rendered, url: string): Rendered {
  const href = escapeHtml(url);
  const html =
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse"><tr><td>${r.html}</td></tr>` +
    `<tr><td style="padding:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:14px;color:#8A94A3">Signature by <a href="${href}" style="color:#8A94A3;text-decoration:underline">Tshaeno</a></td></tr></table>`;
  return { html, text: `${r.text}\n\nSignature by Tshaeno: ${url}` };
}
