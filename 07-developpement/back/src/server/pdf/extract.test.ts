/**
 * Extraction PDF (US-2.4) — le module ne doit JAMAIS lever : tout échec vaut
 * `{ text: "", pageCount: 0 }` (parcours « illisible », US-2.6).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { usefulLength } from "../../lib/useful-text.js";
import { extractPdfText } from "./extract.js";

const FIXTURES = fileURLToPath(new URL("../../../test/fixtures/", import.meta.url));
const fixture = (name: string) => readFileSync(`${FIXTURES}${name}`);

describe("extractPdfText", () => {
  it("courrier-1p.pdf → texte complet (date, montant, référence), 1 page, < 5 s", async () => {
    const start = performance.now();
    const { text, pageCount } = await extractPdfText(fixture("courrier-1p.pdf"));
    const elapsed = performance.now() - start;

    expect(pageCount).toBe(1);
    expect(text).toContain("15 septembre 2026");
    expect(text).toContain("128,50");
    expect(text).toContain("0847213C");
    expect(elapsed).toBeLessThan(5000);
  });

  it("buffer corrompu → { text: '', pageCount: 0 } sans lever", async () => {
    const garbage = Buffer.from("%PDF-1.4 ceci n'est pas un vrai pdf");
    await expect(extractPdfText(garbage)).resolves.toEqual({ text: "", pageCount: 0 });
  });

  it("buffer vide → illisible sans lever", async () => {
    await expect(extractPdfText(Buffer.alloc(0))).resolves.toEqual({ text: "", pageCount: 0 });
  });

  it("scanne-vide.pdf → moins de 100 caractères utiles (candidat barrière)", async () => {
    const { text, pageCount } = await extractPdfText(fixture("scanne-vide.pdf"));
    expect(pageCount).toBe(1);
    expect(usefulLength(text)).toBeLessThan(100);
  });

  it("many-pages.pdf → pageCount 11 (au-delà du plafond, décision du service)", async () => {
    const { pageCount } = await extractPdfText(fixture("many-pages.pdf"));
    expect(pageCount).toBe(11);
  });
});
