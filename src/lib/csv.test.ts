import { describe, expect, it } from "vitest";
import { mapHeaders, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("reads quotes, doubled quotes, line breaks in quotes and CRLF", () => {
    const rows = parseCsv('\uFEFFName,Title\r\n"Kgosi, Thato","Driver ""Long Haul"""\r\n"Two\nlines",x\r\n\r\n');
    expect(rows).toEqual([
      ["Name", "Title"],
      ["Kgosi, Thato", 'Driver "Long Haul"'],
      ["Two\nlines", "x"],
    ]);
  });

  it("detects semicolons and tabs", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("mapHeaders", () => {
  it("recognises common header names and custom fields", () => {
    expect(mapHeaders(["E-mail", "Given name", "Surname", "Job Title", "Dept", "Mobile phone", "Pronouns", "Notes"], ["pronouns"])).toEqual([
      "email",
      "firstName",
      "lastName",
      "title",
      "department",
      "mobile",
      "custom.pronouns",
      null,
    ]);
  });
});
