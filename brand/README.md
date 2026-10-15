# Tshaeno brand

Tshaeno puts the right signature at the end of every email, for teams of 2 to 10,000 and more. The brand is built to read as an established firm: midnight navy, a champagne accent used sparingly, warm stone neutrals, a serif for headlines and a handwritten wordmark, because a signature is the thing we make.

## The wordmark and mark

The wordmark is "Tshaeno" in a flowing script (Great Vibes, converted to outlines, so it never depends on a font being installed). It is always set in one colour: midnight on light, white or champagne on dark.

The mark is the script T on its own, in champagne on a rounded midnight tile. Use it where the wordmark won't fit: the browser tab, app icons, avatars.

## Files

| File | Use it on |
| --- | --- |
| `logo/mark.svg` | Light backgrounds (navy tile) |
| `logo/mark-dark.svg` | Dark backgrounds (a lighter tile, so it separates from the page) |
| `logo/mark-mono.svg` | One colour print, embossing, watermarks. Uses `currentColor` |
| `logo/wordmark.svg` | Light backgrounds, midnight |
| `logo/wordmark-dark.svg` | Dark backgrounds, white |
| `logo/lockup.svg` | Default logo on light backgrounds |
| `logo/lockup-dark.svg` | Default logo on dark backgrounds |
| `logo/app-icon.svg` | App stores, marketplace listings, home screens (512 by 512) |
| `public/favicon.svg` | Browser tab. Switches its tile colour with `prefers-color-scheme` |
| `colours.svg` | Reference sheet for every colour and semantic token |
| `tokens.json` | Palette, light and dark semantic tokens, type scale |
| `icons/*.svg` | Product icons, 24 by 24, 1.75 stroke, `currentColor` |

On photography or busy colour, use the mark or lockup on a solid panel. Never place the light lockup on a dark page.

## Clear space and minimum size

- Clear space around the mark and the lockup is one quarter of the mark height. Keep text, edges and other logos out of it.
- Minimum size: mark 16 px, lockup 24 px tall, wordmark alone 20 px tall. Script loses its detail below that.
- Do not recolour, rotate, outline, add shadows or stretch any logo file. Never retype the wordmark in another script font.
- In running text, write the name as Tshaeno.

## Colour roles

| Role | Light | Dark |
| --- | --- | --- |
| Ink, headings | Midnight 900 `#11182B` | `#EEEBE5` |
| Brand, buttons | Midnight 800 `#14213D` | Champagne 300 `#D9BC85` |
| Links, focus | Midnight 600 `#2B4A86` | `#E0C690` |
| Accent | Champagne 700 `#8A6A2F` | Champagne 300 `#D9BC85` |
| Page | Stone 50 `#F7F5F1` | Midnight 950 `#0A0D14` |

Champagne is the accent, used in small amounts: a thin rule above a heading, a step number, a check mark. Never use it for large fills or body text on light pages. Champagne 700 passes AA on white for text. On dark pages, buttons turn champagne with dark text.

The full semantic set (surface-0, surface-1, surface-2, border, border-strong, ink, ink-muted, brand, on-brand, brand-soft, accent, link, positive, negative, warning, focus) is in `tokens.json` and matches the app CSS.

## Type

Instrument Serif for display headlines on the website and sign-in pages. Instrument Sans for everything else, interface included. Geist Mono for code, IDs, DNS records and data. Serif headlines are set at regular weight with slightly tight tracking; never bold them.

| Style | Size / line | Font | Weight |
| --- | --- | --- | --- |
| website display | 54 / 58 (40 / 44 on phones) | Instrument Serif | 400 |
| title-1 | 28 / 36 | Instrument Sans | 700 |
| title-2 | 22 / 28 | Instrument Sans | 600 |
| headline | 17 / 24 | Instrument Sans | 600 |
| body | 15 / 24 | Instrument Sans | 400 |
| callout | 13 / 20 | Instrument Sans | 400 |
| caption | 12 / 16 | Instrument Sans | 500 |

Body text never goes below 15 px.

## Icons

Twelve product icons in `icons/`: signature, template, brand-kit, directory-sync, google, microsoft, rules, coverage, campaign, analytics, users, shield. All are 24 by 24 with a 1.75 stroke, round caps and joins, no fill, and `stroke="currentColor"`, so they take the colour of the text around them. The google and microsoft icons are generic shapes. Use the official logos only where the partner guidelines require them.

## Copy rules

- Plain. Short words, short sentences. Say what happens.
- Confident. State it once. No hedging, no hype.
- No exclamation marks.
- No em dashes. Use a full stop, a comma or a colon.
- Sentence case for headings, buttons and menus.
- Name things the way admins do: signatures, templates, users, groups, rules.

Good: "Signatures are live for 1,240 users." Not good: "Awesome, your signatures are now live" with an exclamation mark on the end.
