import { describe, expect, it } from "vitest";
import { confidenceLabel, formatFrenchDate, organismeLabel } from "./result-format";

describe("organismeLabel", () => {
  it("mappe les codes connus", () => {
    expect(organismeLabel("CAF")).toBe("CAF");
    expect(organismeLabel("FRANCE_TRAVAIL")).toBe("France Travail");
  });

  it("INDETERMINE et code inconnu → « Organisme non déterminé »", () => {
    expect(organismeLabel("INDETERMINE")).toBe("Organisme non déterminé");
    expect(organismeLabel("PARFUM")).toBe("Organisme non déterminé");
  });
});

describe("formatFrenchDate", () => {
  it("formate une date ISO en toutes lettres", () => {
    expect(formatFrenchDate("2026-08-02T00:00:00.000Z")).toBe("2 août 2026");
  });

  it("null / chaîne vide / date invalide → chaîne vide", () => {
    expect(formatFrenchDate(null)).toBe("");
    expect(formatFrenchDate("")).toBe("");
    expect(formatFrenchDate("pas une date")).toBe("");
  });
});

describe("confidenceLabel (US-4.3 AC2 / D10)", () => {
  it("FAIBLE → libellé par défaut ou surchargé", () => {
    expect(confidenceLabel("FAIBLE")).toBe("À vérifier");
    expect(confidenceLabel("FAIBLE", "Date à vérifier")).toBe("Date à vérifier");
  });

  it("MOYEN → signal texte explicite", () => {
    expect(confidenceLabel("MOYEN")).toBe("Confiance moyenne");
  });

  it("ELEVE → aucun signal", () => {
    expect(confidenceLabel("ELEVE")).toBeNull();
  });
});
