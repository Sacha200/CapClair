/**
 * E5 US-5.1 — statut de pilotage dérivé automatiquement à la fin de l'analyse
 * (`applyAnalysis`), sauf verrouillage manuel préalable (`userLockedFields`
 * contient déjà "status", posé par `PATCH …/statut`).
 *
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
const SUMMARY =
  "La CAF vous demande un justificatif. Vous devez le renvoyer avant la date limite. " +
  "Sans réponse, votre aide peut être suspendue.";

function validResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    organisme: "CAF",
    typeCourrier: "Demande de pièces justificatives",
    dateCourrierRawText: "3 juillet 2026",
    informationsExtraites: [],
    resume: SUMMARY,
    actions: [],
    justificatifs: [],
    echeancePrincipale: null,
    brouillonReponse: "Madame, Monsieur, veuillez trouver ci-joint le justificatif demandé.",
    avertissements: [],
    ...overrides,
  };
}

async function seedCase(
  overrides: { userLockedFields?: string[]; status?: "A_ANALYSER" | "TERMINE" } = {},
): Promise<{ caseFileId: string; userId: string }> {
  const { user } = await createUser(prisma);
  const caseFile = await prisma.caseFile.create({
    data: {
      userId: user.id,
      organisme: "INDETERMINE",
      title: "courrier.pdf",
      ...(overrides.status ? { status: overrides.status } : {}),
      ...(overrides.userLockedFields ? { userLockedFields: overrides.userLockedFields } : {}),
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
  return { caseFileId: caseFile.id, userId: user.id };
}

beforeEach(async () => {
  await truncateAll(prisma);
  analyzeLetterMock.mockReset();
});
afterAll(() => disconnectTestPrisma());

describe("statut de pilotage auto-dérivé après analyse (US-5.1)", () => {
  it("résultat avec ≥ 1 action → ACTION_REQUISE", async () => {
    analyzeLetterMock.mockResolvedValue({
      result: validResult({
        actions: [
          {
            title: "Envoyer le justificatif de domicile",
            sourceExcerpt: EXCERPT,
            dueDateRawText: null,
          },
        ],
      }),
    });
    const { caseFileId } = await seedCase();

    await runAnalysisJob(caseFileId);

    const caseFile = await prisma.caseFile.findUniqueOrThrow({ where: { id: caseFileId } });
    expect(caseFile.status).toBe("ACTION_REQUISE");
  });

  it("résultat avec 0 action → TERMINE", async () => {
    analyzeLetterMock.mockResolvedValue({ result: validResult({ actions: [] }) });
    const { caseFileId } = await seedCase();

    await runAnalysisJob(caseFileId);

    const caseFile = await prisma.caseFile.findUniqueOrThrow({ where: { id: caseFileId } });
    expect(caseFile.status).toBe("TERMINE");
  });

  it("userLockedFields contient déjà \"status\" → statut inchangé, quel que soit le nombre d'actions", async () => {
    analyzeLetterMock.mockResolvedValue({
      result: validResult({
        actions: [
          { title: "Une action IA", sourceExcerpt: EXCERPT, dueDateRawText: null },
        ],
      }),
    });
    const { caseFileId } = await seedCase({
      status: "TERMINE",
      userLockedFields: ["status"],
    });

    await runAnalysisJob(caseFileId);

    const caseFile = await prisma.caseFile.findUniqueOrThrow({ where: { id: caseFileId } });
    // Statut verrouillé manuellement : la présence d'actions (qui aurait dû
    // dériver ACTION_REQUISE) est ignorée.
    expect(caseFile.status).toBe("TERMINE");
  });
});
