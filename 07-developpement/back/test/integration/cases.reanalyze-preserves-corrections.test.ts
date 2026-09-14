/**
 * E4 US-4.4 AC3 + E5 US-5.2 — ce qu'une ré-analyse (`runAnalysisJob` rejoué)
 * ne doit JAMAIS écraser.
 *
 * `applyAnalysis` remplace intégralement le graphe dérivé d'un dossier, SAUF :
 *  - les champs scalaires listés dans `userLockedFields` (E4, déjà couvert par
 *    `analysis.worker.test.ts` — reproduit ici pour le même scénario global) ;
 *  - depuis E5, les `ActionItem`/`RequiredDocument` déjà traités par
 *    l'utilisateur (cochés, ajoutés à la main, ou porteurs d'une note).
 *
 * Seeds au niveau DB/factory direct (pas de route HTTP — les routes actions/
 * justificatifs n'existent pas encore, tâche suivante de l'epic E5).
 * `runAnalysisJob` est appelé en direct (pas de Redis) ; seul `analyzeLetter`
 * est mocké — même gabarit que `analysis.worker.test.ts`.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisResult } from "@capclair/contract";
import type * as AiIndex from "../../src/server/ai/index.js";

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

const EXCERPT = "Passage confidentiel du courrier fictif";
const SUMMARY = "La CAF vous demande un justificatif.";

function validResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    organisme: "CPAM",
    typeCourrier: "Notification de l'Assurance Maladie",
    // Diverge volontairement de la date verrouillée (15 janvier 2026) pour
    // prouver que `documentDate` n'est pas réécrit tant qu'il est verrouillé.
    dateCourrierRawText: "3 juillet 2026",
    informationsExtraites: [],
    resume: SUMMARY,
    actions: [
      { title: "Action IA (nouvelle)", sourceExcerpt: EXCERPT, dueDateRawText: null },
    ],
    justificatifs: [{ name: "Justificatif IA (nouveau)", sourceExcerpt: EXCERPT }],
    // Diverge volontairement de l'échéance verrouillée (EXPLICITE/ELEVE) pour
    // prouver que `mainDeadline*` n'est pas réécrit tant qu'il est verrouillé.
    echeancePrincipale: {
      type: "RELATIVE",
      rawText: "un mois à compter de la réception",
      sourceExcerpt: EXCERPT,
    },
    brouillonReponse: "Madame, Monsieur, veuillez trouver ci-joint le justificatif demandé.",
    avertissements: [],
    ...overrides,
  };
}

beforeEach(async () => {
  await truncateAll(prisma);
  analyzeLetterMock.mockReset();
});
afterAll(() => disconnectTestPrisma());

describe("ré-analyse : ce qui est protégé (E4 US-4.4 AC3 + E5 US-5.2)", () => {
  it("préserve les 4 scalaires verrouillés (E4), les actions/justificatifs traités par l'utilisateur (E5) ; remplace le reste", async () => {
    analyzeLetterMock.mockResolvedValue({ result: validResult() });

    const { user } = await createUser(prisma);
    const LOCKED_DOCUMENT_DATE = new Date("2026-01-15T00:00:00.000Z");
    const LOCKED_MAIN_DEADLINE = new Date("2026-02-15T00:00:00.000Z");
    const caseFile = await prisma.caseFile.create({
      data: {
        userId: user.id,
        organisme: "FRANCE_TRAVAIL",
        title: "Titre corrigé à la main",
        documentDate: LOCKED_DOCUMENT_DATE,
        documentDateSourceExcerpt: "Corrigée par vous",
        mainDeadline: LOCKED_MAIN_DEADLINE,
        mainDeadlineType: "EXPLICITE",
        mainDeadlineSourceExcerpt: "Corrigée par vous",
        mainDeadlineConfidence: "ELEVE",
        userLockedFields: ["organisme", "title", "documentDate", "mainDeadline"],
        documents: {
          create: {
            originalName: "courrier.pdf",
            mimeType: "application/pdf",
            sizeBytes: 2048,
            storagePath: "fixtures/courrier.pdf",
            extractedText: `Caisse d'Allocations Familiales. ${EXCERPT}.`,
          },
        },
      },
    });

    // --- ActionItem : triptyque de protection (E5 US-5.2) ---
    const manuelNonFait = await prisma.actionItem.create({
      data: {
        caseFileId: caseFile.id,
        title: "Action ajoutée à la main",
        origin: "MANUEL",
        done: false,
      },
    });
    const analyseCochee = await prisma.actionItem.create({
      data: {
        caseFileId: caseFile.id,
        title: "Action IA déjà cochée",
        origin: "ANALYSE",
        done: true,
      },
    });
    const analyseNonCochee = await prisma.actionItem.create({
      data: {
        caseFileId: caseFile.id,
        title: "Action IA non traitée",
        origin: "ANALYSE",
        done: false,
      },
    });

    // --- RequiredDocument : triptyque de protection (E5 US-5.2) ---
    const fourni = await prisma.requiredDocument.create({
      data: {
        caseFileId: caseFile.id,
        name: "Justificatif fourni",
        sourceExcerpt: "…",
        provided: true,
      },
    });
    const avecNote = await prisma.requiredDocument.create({
      data: {
        caseFileId: caseFile.id,
        name: "Justificatif avec note",
        sourceExcerpt: "…",
        provided: false,
        userNote: "Je l'envoie la semaine prochaine.",
      },
    });
    const nonTraite = await prisma.requiredDocument.create({
      data: {
        caseFileId: caseFile.id,
        name: "Justificatif non traité",
        sourceExcerpt: "…",
        provided: false,
      },
    });

    await runAnalysisJob(caseFile.id);

    const after = await prisma.caseFile.findUniqueOrThrow({ where: { id: caseFile.id } });
    // Scalaires verrouillés (E4 AC3) : conservés malgré la réponse IA divergente.
    expect(after.organisme).toBe("FRANCE_TRAVAIL");
    expect(after.title).toBe("Titre corrigé à la main");
    expect(after.documentDate?.toISOString()).toBe(LOCKED_DOCUMENT_DATE.toISOString());
    expect(after.documentDateSourceExcerpt).toBe("Corrigée par vous");
    expect(after.mainDeadline?.toISOString()).toBe(LOCKED_MAIN_DEADLINE.toISOString());
    expect(after.mainDeadlineType).toBe("EXPLICITE");
    expect(after.mainDeadlineConfidence).toBe("ELEVE");
    // Non verrouillable : rafraîchi.
    expect(after.summary).toBe(SUMMARY);

    const actionItems = await prisma.actionItem.findMany({ where: { caseFileId: caseFile.id } });
    const actionIds = actionItems.map((a) => a.id);
    expect(actionIds).toContain(manuelNonFait.id);
    expect(actionIds).toContain(analyseCochee.id);
    expect(actionIds).not.toContain(analyseNonCochee.id);
    // Remplacée par la nouvelle action du résultat mocké.
    expect(actionItems.some((a) => a.title === "Action IA (nouvelle)")).toBe(true);

    const requiredDocs = await prisma.requiredDocument.findMany({
      where: { caseFileId: caseFile.id },
    });
    const docIds = requiredDocs.map((d) => d.id);
    expect(docIds).toContain(fourni.id);
    expect(docIds).toContain(avecNote.id);
    expect(docIds).not.toContain(nonTraite.id);
    expect(requiredDocs.some((d) => d.name === "Justificatif IA (nouveau)")).toBe(true);
  });
});
