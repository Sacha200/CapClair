import { describe, expect, it } from "vitest";
import {
  countOverlongActionTitles,
  countWords,
  inspectSummary,
  splitSentences,
} from "./postprocess.js";

describe("splitSentences", () => {
  it("coupe sur . ! ? … suivis d'un blanc", () => {
    expect(splitSentences("Phrase une. Phrase deux ! Phrase trois ? Fin…")).toEqual([
      "Phrase une.",
      "Phrase deux !",
      "Phrase trois ?",
      "Fin…",
    ]);
  });

  it("ignore les fragments vides et les espaces", () => {
    expect(splitSentences("  Seule phrase.   ")).toEqual(["Seule phrase."]);
    expect(splitSentences("")).toEqual([]);
  });
});

describe("inspectSummary (US-3.4 AC1/AC2)", () => {
  it("3 à 8 phrases, aucune > 25 mots → conforme", () => {
    const summary = "La CAF demande un document. Vous devez le renvoyer vite. Sinon l'aide s'arrête.";
    expect(inspectSummary(summary)).toEqual({
      sentenceCount: 3,
      longestSentenceWords: 5,
      withinBounds: true,
    });
  });

  it("moins de 3 phrases → hors bornes", () => {
    expect(inspectSummary("Une phrase. Deux phrases.").withinBounds).toBe(false);
  });

  it("une phrase de plus de 25 mots → hors bornes", () => {
    const long = `${Array.from({ length: 26 }, (_, i) => `mot${i}`).join(" ")}.`;
    const summary = `Phrase courte. ${long} Autre phrase courte.`;
    const shape = inspectSummary(summary);
    expect(shape.longestSentenceWords).toBe(26);
    expect(shape.withinBounds).toBe(false);
  });
});

describe("countWords / countOverlongActionTitles (US-3.5 AC1)", () => {
  it("compte les mots d'un titre", () => {
    expect(countWords("Envoyer le justificatif de domicile")).toBe(5);
    expect(countWords("   ")).toBe(0);
  });

  it("dénombre les titres de plus de 15 mots", () => {
    const ok = "Envoyer le justificatif de domicile";
    const tooLong = Array.from({ length: 16 }, (_, i) => `mot${i}`).join(" ");
    expect(countOverlongActionTitles([ok, tooLong, ok])).toBe(1);
  });
});
