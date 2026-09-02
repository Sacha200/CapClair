/**
 * US-3.2 / D7 / D8 — Traitement d'un job d'analyse par le worker.
 *
 * `runAnalysisJob` est appelé en direct (pas de Redis) ; seul `analyzeLetter`
 * (appel réseau à Anthropic) est mocké. Vérifie les transitions de statut, la
 * persistance du graphe, l'idempotence, la préservation des corrections
 * utilisateur, la relance de validation et l'`AuditEvent` sans contenu sensible.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisResult } from "@capclair/contract";
import type * as AiIndex from "../../src/server/ai/index.js";

// `vi.hoisted` : le mock doit exister avant que la factory de `vi.mock` (hissée)
// ne s'exécute — et une variable classique déclarée ici serait en TDZ.
const { analyzeLetterMock } = vi.hoisted(() => ({
  analyzeLetterMock: vi.fn<() => Promise<{ result: AnalysisResult | null }>>(),
}));

vi.mock("../../src/server/ai/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof AiIndex>();
  return { ...actual, analyzeLetter: analyzeLetterMock };
});

import { runAnalysisJob } from "../../src/worker/analysis.js";
import { createUser } from "../helpers/factories.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";

const prisma = testPrisma();

// Jetons distinctifs : présents dans le courrier et la réponse IA, jamais
// attendus dans les métadonnées de l'AuditEvent (US-8.2).
const REF = "0847213C-SECRET";
const EXCERPT = "Passage confidentiel du courrier fictif";
const SUMMARY =
  "La CAF vous demande un justificatif. Vous devez le renvoyer avant la date limite. " +
  "Sans réponse, votre aide peut être suspendue.";

function validResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    organisme: "CAF",
    typeCourrier: "Demande de pièces justificatives",
    // Juillet/août : fenêtre sans bascule d'heure d'été (date-fns opère en local).
    dateCourrierRawText: "3 juillet 2026",
    informationsExtraites: [
      {
        category: "REFERENCE",
        label: "Numéro d'allocataire",
        value: REF,
        sourceExcerpt: EXCERPT,
        confidence: "ELEVE",
      },
    ],
    resume: SUMMARY,
    actions: [
      {
        title: "Envoyer le justificatif de domicile",
        sourceExcerpt: EXCERPT,
        dueDateRawText: "30 jours à compter de la réception",
      },
    ],
    justificatifs: [{ name: "Justificatif de domicile", sourceExcerpt: EXCERPT }],
    echeancePrincipale: {
      type: "RELATIVE",
      rawText: "un mois à compter de la réception",
      sourceExcerpt: EXCERPT,
    },
    brouillonReponse: "Madame, Monsieur, veuillez trouver ci-joint le justificatif demandé.",
    avertissements: ["Sans réponse, le versement peut être suspendu."],
    ...overrides,
  };
}

async function seedCase(): Promise<{ caseFileId: string; userId: string }> {
  const { user } = await createUser(prisma);
  const caseFile = await prisma.caseFile.create({
    data: {
      userId: user.id,
      organisme: "INDETERMINE",
      title: "courrier.pdf",
      documents: {
        create: {
          originalName: "courrier.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2048,
          storagePath: "fixtures/courrier.pdf",
          extractedText: `Caisse d'Allocations Familiales. ${EXCERPT}. Référence ${REF}.`,
        },
      },
    },
  });
  return { caseFileId: caseFile.id, userId: user.id };
}

beforeEach(async () => {
  await truncateAll(prisma);
  analyzeLetterMock.mockReset();
});
afterAll(() => disconnectTestPrisma());

describe("runAnalysisJob", () => {
  it("succès : EN_COURS → TERMINEE, graphe persisté, dates dérivées serveur (D7)", async () => {
    analyzeLetterMock.mockResolvedValue({ result: validResult() });
    const { caseFileId } = await seedCase();

    await runAnalysisJob(caseFileId);

    const caseFile = await prisma.caseFile.findUniqueOrThrow({
      where: { id: caseFileId },
      include: { extractedInfos: true, actionItems: true, requiredDocs: true, responseDraft: true },
    });

    expect(caseFile.analysisStatus).toBe("TERMINEE");
    expect(caseFile.status).toBe("A_FAIRE");
    expect(caseFile.organisme).toBe("CAF");
    expect(caseFile.title).toBe("Demande de pièces justificatives");
    expect(caseFile.summary).toBe(SUMMARY);
    expect(caseFile.warnings).toHaveLength(1);

    // Date du courrier : "3 juillet 2026" résolue par le serveur (D7).
    expect(caseFile.documentDate?.toISOString()).toBe("2026-07-03T00:00:00.000Z");
    // Échéance principale : "un mois" à compter du 3 juillet → 3 août, RELATIVE/MOYEN.
    expect(caseFile.mainDeadline?.toISOString()).toBe("2026-08-03T00:00:00.000Z");
    expect(caseFile.mainDeadlineType).toBe("RELATIVE");
    expect(caseFile.mainDeadlineConfidence).toBe("MOYEN");

    expect(caseFile.extractedInfos).toHaveLength(1);
    expect(caseFile.actionItems).toHaveLength(1);
    // "30 jours à compter de la réception" à compter du 3 juillet → 2 août.
    expect(caseFile.actionItems[0]!.dueDate?.toISOString()).toBe("2026-08-02T00:00:00.000Z");
    expect(caseFile.requiredDocs).toHaveLength(1);
    expect(caseFile.responseDraft?.content).toContain("ci-joint");
  });

  it("AuditEvent analysis.completed — compteurs uniquement, aucun contenu de courrier (US-8.2)", async () => {
    analyzeLetterMock.mockResolvedValue({ result: validResult() });
    const { caseFileId } = await seedCase();

    await runAnalysisJob(caseFileId);

    const events = await prisma.auditEvent.findMany({ where: { caseFileId } });
    expect(events).toHaveLength(1);
    expect(events[0]!.eventType).toBe("analysis.completed");

    const serialized = JSON.stringify(events[0]!.metadata);
    for (const secret of [REF, EXCERPT, SUMMARY, "ci-joint"]) {
      expect(serialized).not.toContain(secret);
    }
    expect(events[0]!.metadata).toMatchObject({
      organisme: "CAF",
      counts: { informations: 1, actions: 1, requiredDocuments: 1, warnings: 1 },
    });
  });

  it("réponse invalide : 2 tentatives puis ECHEC, rien n'est persisté (AC2/AC3)", async () => {
    analyzeLetterMock.mockResolvedValue({ result: null });
    const { caseFileId } = await seedCase();

    await runAnalysisJob(caseFileId);

    expect(analyzeLetterMock).toHaveBeenCalledTimes(2);
    const caseFile = await prisma.caseFile.findUniqueOrThrow({ where: { id: caseFileId } });
    expect(caseFile.analysisStatus).toBe("ECHEC");
    expect(await prisma.actionItem.count({ where: { caseFileId } })).toBe(0);
    expect(await prisma.extractedInformation.count({ where: { caseFileId } })).toBe(0);

    const events = await prisma.auditEvent.findMany({ where: { caseFileId } });
    expect(events[0]!.eventType).toBe("analysis.failed");
    expect(events[0]!.metadata).toEqual({ reason: "AnalysisValidationError" });
  });

  it("relance de validation : échec puis succès au 2ᵉ appel → TERMINEE", async () => {
    analyzeLetterMock
      .mockResolvedValueOnce({ result: null })
      .mockResolvedValueOnce({ result: validResult() });
    const { caseFileId } = await seedCase();

    await runAnalysisJob(caseFileId);

    expect(analyzeLetterMock).toHaveBeenCalledTimes(2);
    const caseFile = await prisma.caseFile.findUniqueOrThrow({ where: { id: caseFileId } });
    expect(caseFile.analysisStatus).toBe("TERMINEE");
  });

  it("idempotent + préserve les ExtractedInformation corrigées par l'utilisateur (§2 #11)", async () => {
    analyzeLetterMock.mockResolvedValue({ result: validResult() });
    const { caseFileId } = await seedCase();

    const category = await prisma.category.findFirstOrThrow({ where: { code: "AUTRE" } });
    await prisma.extractedInformation.create({
      data: {
        caseFileId,
        categoryId: category.id,
        label: "Corrigé à la main",
        value: "valeur utilisateur",
        sourceExcerpt: "correction",
        isUserCorrected: true,
      },
    });

    await runAnalysisJob(caseFileId);
    await runAnalysisJob(caseFileId);

    const infos = await prisma.extractedInformation.findMany({ where: { caseFileId } });
    // 1 ligne IA (recréée à l'identique, pas dupliquée) + 1 ligne corrigée préservée.
    expect(infos).toHaveLength(2);
    expect(infos.filter((i) => i.isUserCorrected)).toHaveLength(1);
    expect(await prisma.actionItem.count({ where: { caseFileId } })).toBe(1);
  });
});
