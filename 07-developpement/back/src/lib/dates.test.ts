import { describe, expect, it } from "vitest";
import type { EcheanceIA } from "@capclair/contract";
import {
  deriveDeadline,
  deriveDeadlineFromText,
  parseExplicitFrenchDate,
  resolveRelativeDelay,
} from "./dates.js";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("parseExplicitFrenchDate (US-3.6 AC1)", () => {
  it("reconnaît les formats du corpus", () => {
    expect(parseExplicitFrenchDate("avant le 5 juillet 2026")).toEqual(utc(2026, 7, 5));
    expect(parseExplicitFrenchDate("Cette somme doit nous être remboursée avant le 20 septembre 2026")).toEqual(
      utc(2026, 9, 20),
    );
    expect(parseExplicitFrenchDate("Merci de nous transmettre ce document avant le 5 août 2026")).toEqual(
      utc(2026, 8, 5),
    );
  });

  it("gère l'ordinal « 1er »", () => {
    expect(parseExplicitFrenchDate("avant le 1er septembre 2026")).toEqual(utc(2026, 9, 1));
  });

  it("ignore une heure accolée", () => {
    expect(parseExplicitFrenchDate("le 12 août 2026 à 10h00")).toEqual(utc(2026, 8, 12));
  });

  it("insensible aux accents et à la casse", () => {
    expect(parseExplicitFrenchDate("avant le 5 AOUT 2026")).toEqual(utc(2026, 8, 5));
  });

  it("rejette un jour inexistant plutôt que de le décaler", () => {
    expect(parseExplicitFrenchDate("avant le 31 avril 2026")).toBeNull();
  });

  it("renvoie null sans motif reconnu — jamais d'invention", () => {
    expect(parseExplicitFrenchDate("dans les meilleurs délais")).toBeNull();
    expect(parseExplicitFrenchDate("")).toBeNull();
  });
});

describe("resolveRelativeDelay (US-3.6 AC2)", () => {
  const anchor = utc(2026, 7, 3); // date du courrier CAF-01

  it("délai en jours", () => {
    expect(resolveRelativeDelay(anchor, "30 jours à compter de la réception du présent courrier")).toEqual(
      utc(2026, 8, 2),
    );
    expect(resolveRelativeDelay(anchor, "15 jours à compter de la réception du présent courrier")).toEqual(
      utc(2026, 7, 18),
    );
  });

  it("délai en mois écrit en toutes lettres", () => {
    expect(resolveRelativeDelay(anchor, "un mois à compter de la réception du présent courrier")).toEqual(
      utc(2026, 8, 3),
    );
  });

  it("renvoie null sans motif reconnu", () => {
    expect(resolveRelativeDelay(anchor, "dans un délai raisonnable")).toBeNull();
  });
});

describe("deriveDeadline (US-3.6)", () => {
  const documentDate = utc(2026, 7, 3);
  const fallbackAnchor = utc(2026, 7, 10); // date d'import, postérieure

  it("échéance explicite reconnue → confiance ELEVE", () => {
    const echeance: EcheanceIA = {
      type: "EXPLICITE",
      rawText: "avant le 15 septembre 2026",
      sourceExcerpt: "avant le 15 septembre 2026",
    };
    expect(deriveDeadline({ echeance, documentDate, fallbackAnchor })).toEqual({
      date: utc(2026, 9, 15),
      type: "EXPLICITE",
      confidence: "ELEVE",
      sourceExcerpt: echeance.sourceExcerpt,
    });
  });

  it("échéance relative avec date du courrier connue → confiance MOYEN, type RELATIVE (AC3)", () => {
    const echeance: EcheanceIA = {
      type: "RELATIVE",
      rawText: "30 jours à compter de la réception du présent courrier",
      sourceExcerpt: "dans un délai de 30 jours à compter de la réception du présent courrier",
    };
    const result = deriveDeadline({ echeance, documentDate, fallbackAnchor });
    expect(result?.date).toEqual(utc(2026, 8, 2));
    expect(result?.type).toBe("RELATIVE");
    expect(result?.confidence).toBe("MOYEN");
  });

  it("échéance relative sans date du courrier → repli sur la date d'import, confiance FAIBLE", () => {
    const echeance: EcheanceIA = {
      type: "RELATIVE",
      rawText: "15 jours à compter de la réception du présent courrier",
      sourceExcerpt: "…",
    };
    const result = deriveDeadline({ echeance, documentDate: null, fallbackAnchor });
    expect(result?.date).toEqual(utc(2026, 7, 25));
    expect(result?.confidence).toBe("FAIBLE");
  });

  it("échéance explicite antérieure à la date du courrier → rejetée (AC5)", () => {
    const echeance: EcheanceIA = {
      type: "EXPLICITE",
      rawText: "avant le 1 juillet 2026", // avant documentDate (3 juillet)
      sourceExcerpt: "…",
    };
    const result = deriveDeadline({ echeance, documentDate, fallbackAnchor });
    expect(result?.date).toBeNull();
    expect(result?.confidence).toBe("FAIBLE");
  });

  it("échéance non reconnue → date null plutôt qu'une valeur devinée", () => {
    const echeance: EcheanceIA = {
      type: "EXPLICITE",
      rawText: "dès que possible",
      sourceExcerpt: "…",
    };
    expect(deriveDeadline({ echeance, documentDate, fallbackAnchor })?.date).toBeNull();
  });

  it("aucune échéance → null", () => {
    expect(deriveDeadline({ echeance: null, documentDate, fallbackAnchor })).toBeNull();
  });
});

describe("deriveDeadlineFromText (délai d'action, US-3.5 — type inféré)", () => {
  // Ancres en juillet/août : fenêtre sans bascule d'heure d'été (comme les
  // tests `resolveRelativeDelay` ci-dessus), `date-fns` opérant en heure locale.
  const documentDate = utc(2026, 7, 3);
  const fallbackAnchor = utc(2026, 7, 10);

  it("rawText absent → null", () => {
    expect(
      deriveDeadlineFromText({ rawText: null, sourceExcerpt: "…", documentDate, fallbackAnchor }),
    ).toBeNull();
  });

  it("date explicite reconnue → EXPLICITE / ELEVE", () => {
    const r = deriveDeadlineFromText({
      rawText: "avant le 5 septembre 2026",
      sourceExcerpt: "extrait",
      documentDate,
      fallbackAnchor,
    });
    expect(r).toMatchObject({ type: "EXPLICITE", confidence: "ELEVE", sourceExcerpt: "extrait" });
    expect(r?.date).toEqual(utc(2026, 9, 5));
  });

  it("délai relatif + date du courrier connue → RELATIVE / MOYEN, calculé depuis la date du courrier", () => {
    const r = deriveDeadlineFromText({
      rawText: "sous 30 jours",
      sourceExcerpt: "…",
      documentDate,
      fallbackAnchor,
    });
    expect(r).toMatchObject({ type: "RELATIVE", confidence: "MOYEN" });
    expect(r?.date).toEqual(utc(2026, 8, 2));
  });

  it("délai relatif sans date du courrier → repli sur l'ancre d'import, confiance FAIBLE", () => {
    const r = deriveDeadlineFromText({
      rawText: "sous 30 jours",
      sourceExcerpt: "…",
      documentDate: null,
      fallbackAnchor,
    });
    expect(r).toMatchObject({ type: "RELATIVE", confidence: "FAIBLE" });
    expect(r?.date).toEqual(utc(2026, 8, 9));
  });

  it("ni date ni délai reconnus → null", () => {
    expect(
      deriveDeadlineFromText({
        rawText: "dès que possible",
        sourceExcerpt: "…",
        documentDate,
        fallbackAnchor,
      }),
    ).toBeNull();
  });
});
