import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** The website follows the copy rules: no exclamation marks and no em or en dashes. */
const ROOTS = ["src/app/(site)", "src/components/site", "src/lib/site"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(p) && !p.endsWith(".test.ts") ? [p] : [];
  });
}

describe("website copy", () => {
  const all = ROOTS.flatMap(files);

  it("finds the pages", () => {
    expect(all.length).toBeGreaterThan(8);
  });

  it.each(all)("%s has no dashes or exclamation marks in its words", (file) => {
    const src = readFileSync(file, "utf8");
    expect(src).not.toMatch(/[–—]/);
    // Text between JSX tags, and the text inside quoted strings that read as sentences.
    const jsxText = [...src.matchAll(/>([^<>{}]*)</g)].map((m) => m[1]);
    const sentences = [...src.matchAll(/"([A-Z][^"]*\s[^"]*)"/g)].map((m) => m[1]);
    for (const t of [...jsxText, ...sentences]) expect(t, file).not.toMatch(/!(\s|$)/);
  });
});
