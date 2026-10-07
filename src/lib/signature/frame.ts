import { DARK_BACKGROUND, darkModeColour } from "./style";

/**
 * The page a signature preview shows: a short greeting above the
 * signature, on a light or dark background. Dark mode imitates how
 * Outlook and Gmail lighten dark text. The rendering tests use the same
 * page, so what they check is what people see.
 */
export function toDark(html: string): string {
  return html.replace(/(^|[;"\s])color:\s*(#[0-9a-fA-F]{6})/g, (_, pre: string, hex: string) => `${pre}color:${darkModeColour(hex)}`);
}

export function frameDoc(html: string, dark: boolean): string {
  const bg = dark ? DARK_BACKGROUND : "#ffffff";
  const ink = dark ? "#e8e8e8" : "#1f1f1f";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{margin:0;padding:20px 16px;background:${bg};color:${ink};font-family:Arial,sans-serif;font-size:13px}p.greet{margin:0 0 18px;color:${dark ? "#bdbdbd" : "#5f6368"}}a{cursor:default}</style></head><body><p class="greet">Kind regards,</p>${dark ? toDark(html) : html}</body></html>`;
}
