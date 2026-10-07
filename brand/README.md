# Tshaeno brand

Tshaeno puts the right signature at the end of every email, for teams of 2 to 10,000 and more. The brand is built to match: deep navy, teal, one sharp accent, neutral greys and strong type. It works in light and dark, and it is designed for the phone first.

## The mark

A rounded navy tile holds a lowercase t. The crossbar is teal, the stem sweeps into a short white signature stroke, and a Signal orange dot closes it like the full stop at the end of a message. The mark is drawn on a 48 by 48 grid with 6 unit strokes.

## Files

| File | Use it on |
| --- | --- |
| `logo/mark.svg` | Light backgrounds (navy tile) |
| `logo/mark-dark.svg` | Dark backgrounds (Navy 700 tile, so it separates from Navy 950) |
| `logo/mark-mono.svg` | One colour print, embossing, watermarks. Uses `currentColor` |
| `logo/wordmark.svg` | Light backgrounds, Navy 900 |
| `logo/wordmark-dark.svg` | Dark backgrounds, white |
| `logo/lockup.svg` | Default logo on light backgrounds |
| `logo/lockup-dark.svg` | Default logo on dark backgrounds |
| `logo/app-icon.svg` | App stores, marketplace listings, home screens (512 by 512) |
| `public/favicon.svg` | Browser tab. Switches its tile colour with `prefers-color-scheme` |
| `colours.svg` | Reference sheet for every colour and semantic token |
| `tokens.json` | Palette, light and dark semantic tokens, type scale |
| `icons/*.svg` | Product icons, 24 by 24, 1.75 stroke, `currentColor` |

On photography or busy colour, use the mark or lockup on a solid panel. Never place the light lockup on Navy 950.

## Clear space and minimum size

- Clear space around the mark and the lockup is one quarter of the mark height (12 units on the 48 grid). Keep text, edges and other logos out of it.
- Minimum size: mark 16 px, lockup 20 px tall, wordmark alone 12 px tall.
- Do not recolour, rotate, outline, add shadows or stretch any logo file. Do not move the orange dot.
- The wordmark is always lowercase: tshaeno. In running text, write the name as Tshaeno.

## Colour roles

| Role | Light | Dark |
| --- | --- | --- |
| Brand ink, headings | Navy 900 `#0B1F3A` | `#E8EEF5` |
| Brand, buttons, focus | Teal 600 `#0B7F78` | Teal 400 `#2EC4B6` |
| Brand tint | Teal 100 `#DDF4F1` | `#0E3A3B` |
| Accent | Signal `#FF5B2E` | `#FF7A55` |
| Page | Grey `#F6F7F9` | Navy 950 `#07121F` |

Signal orange is the one sharp accent. Use it for the dot in the mark and for one key highlight per screen at most, such as a live badge or a single figure that matters. Never use it for body text, error states or large fills. Teal 600 passes AA on white for text and controls. Teal 400 is for dark surfaces only.

The full semantic set (surface-0, surface-1, surface-2, border, border-strong, ink, ink-muted, brand, on-brand, brand-soft, accent, link, positive, negative, warning, focus) is in `tokens.json` and matches the app CSS.

## Type

Geist Sans for interface and headings, Geist Mono for code, IDs, DNS records and data. Headings use semibold 600 or bold 700 with tight tracking.

| Style | Size / line | Weight | Tracking |
| --- | --- | --- | --- |
| display | 40 / 48 | 700 | -0.02em |
| title-1 | 28 / 36 | 700 | -0.015em |
| title-2 | 22 / 28 | 600 | -0.01em |
| headline | 17 / 24 | 600 | -0.005em |
| body | 15 / 24 | 400 | 0 |
| callout | 13 / 20 | 400 | 0 |
| caption | 12 / 16 | 500 | 0.01em |

On phones, display steps down to title-1. Body text never goes below 15 px.

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
