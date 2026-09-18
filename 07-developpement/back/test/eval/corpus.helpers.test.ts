import { describe, expect, it } from "vitest";
import { compareByExcerpt, excerptsOverlap, isGrounded, normalize } from "./corpus.helpers.js";

describe("normalize", () => {
  it("retire accents, apostrophes typographiques et espaces insécables", () => {
    expect(normalize("Délai de 30 jours à compter")).toBe("delai de 30 jours a compter");
    expect(normalize("l’avis d’imposition")).toBe("l'avis d'imposition");
    expect(normalize("30\u00a0jours\u202fouvrés")).toBe("30 jours ouvres");
  });
});

describe("excerptsOverlap", () => {
  it("apparie un extrait plus large et un extrait plus serré", () => {
    expect(excerptsOverlap("un justificatif de domicile", "justificatif de domicile")).toBe(true);
  });
  it("refuse deux extraits sans recouvrement", () => {
    expect(excerptsOverlap("avis d'imposition", "carte vitale")).toBe(false);
  });
  it("refuse une chaîne vide", () => {
    expect(excerptsOverlap("", "quoi que ce soit")).toBe(false);
  });
});

describe("isGrounded", () => {
  const source = "Merci de nous transmettre un justificatif de domicile de moins de trois mois.";
  it("accepte un extrait littéral", () => {
    expect(isGrounded("justificatif de domicile", source)).toBe(true);
  });
  it("rejette un extrait absent du texte", () => {
    expect(isGrounded("votre relevé d'identité bancaire", source)).toBe(false);
  });
});

describe("compareByExcerpt", () => {
  const source = "Fournir un justificatif de domicile et votre avis d'imposition 2025.";

  it("compte un attendu retrouvé et un attendu manqué", () => {
    const r = compareByExcerpt(
      ["justificatif de domicile", "avis d'imposition 2025"],
      ["un justificatif de domicile"],
      source,
    );
    expect(r).toEqual({ matched: 1, missed: 1, extraGrounded: 0, ungrounded: 0 });
  });

  it("distingue un produit ancré hors référentiel d'un produit non ancré", () => {
    const r = compareByExcerpt(
      ["justificatif de domicile"],
      ["justificatif de domicile", "avis d'imposition 2025", "votre relevé bancaire"],
      source,
    );
    expect(r.matched).toBe(1);
    expect(r.extraGrounded).toBe(1);
    expect(r.ungrounded).toBe(1);
  });

  it("n'apparie jamais deux fois le même produit", () => {
    const r = compareByExcerpt(
      ["justificatif de domicile", "justificatif de domicile"],
      ["justificatif de domicile"],
      source,
    );
    expect(r.matched).toBe(1);
    expect(r.missed).toBe(1);
  });
});
