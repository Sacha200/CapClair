/**
 * E4 US-4.1 → US-4.3 — projection du graphe d'analyse vers le DTO de l'écran 05.
 *
 * Unitaire : `toCaseResultDto` reçoit une ligne façon Prisma construite à la
 * main (pas de base). Vérifie la vérification d'extrait (US-4.2), l'abaissement
 * de confiance (US-4.2 AC3 / US-4.3), le bandeau récap, `overdue` et l'aperçu
 * du brouillon.
 */
import { describe, expect, it } from "vitest";
import { CaseFileResultResponseSchema } from "@capclair/contract";
import {
  isLiteralExcerpt,
  normalizeForExcerptMatch,
  toCaseResultDto,
} from "./cases.mapper.js";

type Row = Parameters<typeof toCaseResultDto>[0];

const TEXT =
  "Caisse d'Allocations Familiales. Votre référence allocataire est 0847213C. " +
  "Vous devez répondre sous 30 jours à compter de la réception de ce courrier.";

function makeInfo(over: Record<string, unknown> = {}) {
  return {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    label: "Référence allocataire",
    value: "0847213C",
    sourceExcerpt: "référence allocataire est 0847213C",
    confidenceLevel: "ELEVE",
    isUserCorrected: false,
    category: { code: "REFERENCE", label: "Référence", icon: "ri-hashtag" },
    ...over,
  };
}

function makeRow(over: Partial<Record<string, unknown>> = {}): Row {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    analysisStatus: "TERMINEE",
    organisme: "CAF",
    title: "Demande de pièces justificatives",
    documentDate: new Date("2026-07-03T00:00:00.000Z"),
    documentDateSourceExcerpt: "le 3 juillet 2026",
    summary: "La CAF vous demande un justificatif.",
    warnings: ["Sans réponse, le versement peut être suspendu."],
    userLockedFields: [],
    mainDeadline: new Date("2026-08-02T00:00:00.000Z"),
    mainDeadlineType: "RELATIVE",
    mainDeadlineSourceExcerpt: "sous 30 jours à compter de la réception",
    mainDeadlineConfidence: "MOYEN",
    extractedInfos: [makeInfo()],
    actionItems: [],
    requiredDocs: [],
    responseDraft: { content: "Madame, Monsieur,\n\nVeuillez trouver ci-joint le justificatif." },
    ...over,
  } as unknown as Row;
}

describe("normalizeForExcerptMatch", () => {
  it("supprime accents et casse", () => {
    expect(normalizeForExcerptMatch("Éléments À Vérifier")).toBe("elements a verifier");
  });

  it("unifie apostrophes typographiques et espaces (NBSP, retours ligne)", () => {
    expect(normalizeForExcerptMatch("l’aide au\nlogement")).toBe(
      normalizeForExcerptMatch("l'aide au logement"),
    );
  });
});

describe("isLiteralExcerpt", () => {
  it("vrai quand l'extrait est une sous-chaîne littérale (insensible accents/casse)", () => {
    expect(isLiteralExcerpt("RÉFÉRENCE allocataire est 0847213C", TEXT)).toBe(true);
  });

  it("faux quand l'extrait est absent du texte", () => {
    expect(isLiteralExcerpt("montant de 450 euros", TEXT)).toBe(false);
  });

  it("faux si l'extrait ou le texte est vide (US-4.2 AC2)", () => {
    expect(isLiteralExcerpt("", TEXT)).toBe(false);
    expect(isLiteralExcerpt("référence", "")).toBe(false);
  });
});

describe("toCaseResultDto", () => {
  it("produit un DTO conforme au schéma du contrat", () => {
    const dto = toCaseResultDto(makeRow(), TEXT);
    expect(() => CaseFileResultResponseSchema.parse(dto)).not.toThrow();
    expect(dto.analysisStatus).toBe("TERMINEE");
    expect(dto.documentDate).toBe("2026-07-03T00:00:00.000Z");
  });

  it("info vérifiable : `verifiable` vrai, confiance stockée conservée", () => {
    const dto = toCaseResultDto(makeRow(), TEXT);
    expect(dto.informations[0]).toMatchObject({ verifiable: true, confidenceLevel: "ELEVE" });
    expect(dto.infosToVerify).toHaveLength(0);
  });

  it("US-4.2 AC3 — extrait introuvable : `verifiable` faux, confiance abaissée à FAIBLE, listé dans infosToVerify", () => {
    const dto = toCaseResultDto(
      makeRow({ extractedInfos: [makeInfo({ sourceExcerpt: "un passage jamais écrit" })] }),
      TEXT,
    );
    expect(dto.informations[0]).toMatchObject({ verifiable: false, confidenceLevel: "FAIBLE" });
    expect(dto.infosToVerify).toEqual([
      { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", label: "Référence allocataire" },
    ]);
  });

  it("une info corrigée par l'utilisateur reste ELEVE et hors du bandeau récap, même si non vérifiable", () => {
    const dto = toCaseResultDto(
      makeRow({
        extractedInfos: [makeInfo({ sourceExcerpt: "passage absent", isUserCorrected: true })],
      }),
      TEXT,
    );
    expect(dto.informations[0]).toMatchObject({
      verifiable: false,
      confidenceLevel: "ELEVE",
      isUserCorrected: true,
    });
    expect(dto.infosToVerify).toHaveLength(0);
  });

  it("échéance : `computedFromDelay` sur type RELATIVE, `overdue` selon la date (comparaison serveur)", () => {
    const past = toCaseResultDto(makeRow(), TEXT);
    expect(past.mainDeadline).toMatchObject({ computedFromDelay: true, overdue: true });

    const future = toCaseResultDto(
      makeRow({ mainDeadline: new Date(Date.now() + 30 * 86_400_000), mainDeadlineType: "EXPLICITE" }),
      TEXT,
    );
    expect(future.mainDeadline).toMatchObject({ computedFromDelay: false, overdue: false });
  });

  it("échéance absente → `mainDeadline` null", () => {
    const dto = toCaseResultDto(
      makeRow({
        mainDeadline: null,
        mainDeadlineType: null,
        mainDeadlineSourceExcerpt: null,
        mainDeadlineConfidence: null,
      }),
      TEXT,
    );
    expect(dto.mainDeadline).toBeNull();
  });

  it("`isUserCorrected` de l'échéance reflète le verrou `mainDeadline`", () => {
    const dto = toCaseResultDto(makeRow({ userLockedFields: ["mainDeadline"] }), TEXT);
    expect(dto.mainDeadline?.isUserCorrected).toBe(true);
    expect(dto.lockedFields).toContain("mainDeadline");
  });

  it("brouillon : aperçu = 2 premières lignes non vides, tronqué à 200 caractères", () => {
    const long = "A".repeat(400);
    const dto = toCaseResultDto(makeRow({ responseDraft: { content: `${long}\n\nligne 2` } }), TEXT);
    expect(dto.responseDraft?.hasContent).toBe(true);
    expect(dto.responseDraft?.preview.length).toBeLessThanOrEqual(201); // 200 + « … »
    expect(dto.responseDraft?.preview.endsWith("…")).toBe(true);
  });

  it("brouillon absent → `responseDraft` null", () => {
    const dto = toCaseResultDto(makeRow({ responseDraft: null }), TEXT);
    expect(dto.responseDraft).toBeNull();
  });

  it("US-8.2 — le texte extrait n'apparaît jamais dans le DTO", () => {
    const dto = toCaseResultDto(makeRow(), TEXT);
    expect(JSON.stringify(dto)).not.toContain("Caisse d'Allocations Familiales");
  });
});
