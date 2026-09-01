import { describe, expect, it } from "vitest";
import { sanitizeNext } from "./routing";

describe("sanitizeNext", () => {
  it("garde un chemin interne", () => {
    expect(sanitizeNext("/dossiers/abc")).toBe("/dossiers/abc");
    expect(sanitizeNext("/dashboard?x=1")).toBe("/dashboard?x=1");
  });

  it("rejette une URL absolue ou un //host (open redirect)", () => {
    expect(sanitizeNext("https://evil.example")).toBe("/dashboard");
    expect(sanitizeNext("//evil.example")).toBe("/dashboard");
    expect(sanitizeNext("/\\evil.example")).toBe("/dashboard");
  });

  it("retombe sur le fallback quand la valeur est absente", () => {
    expect(sanitizeNext(null)).toBe("/dashboard");
    expect(sanitizeNext(undefined, "/x")).toBe("/x");
  });
});
