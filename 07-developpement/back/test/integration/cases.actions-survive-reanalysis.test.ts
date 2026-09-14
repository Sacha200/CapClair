/**
 * E5 US-5.2 — preuve de bout en bout, via les routes HTTP (maintenant qu'elles
 * existent), que la protection anti-ré-analyse des actions couvre le parcours
 * réel de l'utilisateur : coche une action IA, en ajoute une à la main, relance
 * l'analyse (`runAnalysisJob`, `analyzeLetter` mocké — même gabarit que
 * `analysis.worker.test.ts`) — les deux survivent, le reste du jeu d'actions
 * IA initial est remplacé par le nouveau.
 *
 * Complète `cases.reanalyze-preserves-corrections.test.ts` (Task 1), qui teste
 * la garde directement via les factories : ici on passe par les routes
 * `POST`/`PATCH` ajoutées par cette tâche.
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
import { getApp, sessionCookie } from "../helpers/app.js";
import { createUser, seedCaseGraph } from "../helpers/factories.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";

const prisma = testPrisma();

const EXCERPT = "Passage confidentiel du courrier fictif";

function newAnalysisResult(): AnalysisResult {
  return {
    organisme: "CAF",
    typeCourrier: "Demande de pièces justificatives",
    dateCourrierRawText: null,
    informationsExtraites: [],
    resume: "La CAF vous demande un nouveau justificatif.",
    actions: [{ title: "Action IA (nouvelle analyse)", sourceExcerpt: EXCERPT, dueDateRawText: null }],
    justificatifs: [],
    echeancePrincipale: null,
    brouillonReponse: "Madame, Monsieur, …",
    avertissements: [],
  };
}

beforeEach(async () => {
  await truncateAll(prisma);
  analyzeLetterMock.mockReset();
});
afterAll(() => disconnectTestPrisma());

async function loginUser(remoteAddress: string) {
  const app = await getApp();
  const user = await createUser(prisma);
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: user.email, password: user.password },
    remoteAddress,
  });
  return { cookie: sessionCookie(res)!, userId: user.user.id };
}

describe("actions : cochée + ajoutée à la main survivent à une ré-analyse (US-5.2)", () => {
  it("l'action IA cochée et l'action manuelle restent ; les actions IA non traitées sont remplacées", async () => {
    const REMOTE = "198.51.100.160";
    const { cookie, userId } = await loginUser(REMOTE);
    // Action par défaut de `seedCaseGraph` : origin ANALYSE, done false (résultat d'analyse initial).
    const { caseFile, actionItem: initialAction } = await seedCaseGraph(prisma, userId, {
      analysisStatus: "TERMINEE",
      extractedText: `Caisse d'Allocations Familiales. ${EXCERPT}.`,
    });

    const app = await getApp();

    // 2. Coche l'action IA initiale.
    const checkRes = await app.inject({
      method: "PATCH",
      url: `/api/dossiers/${caseFile.id}/actions/${initialAction.id}`,
      headers: { cookie },
      payload: { done: true },
      remoteAddress: REMOTE,
    });
    expect(checkRes.statusCode).toBe(200);

    // 3. Ajoute une action manuelle.
    const addRes = await app.inject({
      method: "POST",
      url: `/api/dossiers/${caseFile.id}/actions`,
      headers: { cookie },
      payload: { title: "Ajoutée à la main" },
      remoteAddress: REMOTE,
    });
    expect(addRes.statusCode).toBe(201);
    const manualActionId = addRes.json().id as string;

    // 4. Relance l'analyse avec un jeu d'actions différent.
    analyzeLetterMock.mockResolvedValue({ result: newAnalysisResult() });
    await runAnalysisJob(caseFile.id);

    // 5. Les deux actions traitées par l'utilisateur survivent ; le nouveau
    //    jeu IA est présent ; aucune action ANALYSE/done:false de l'ancien jeu.
    const resultRes = await app.inject({
      method: "GET",
      url: `/api/dossiers/${caseFile.id}/resultat`,
      headers: { cookie },
      remoteAddress: REMOTE,
    });
    expect(resultRes.statusCode).toBe(200);
    const actions = resultRes.json().actions as Array<{
      id: string;
      title: string;
      origin: string;
      done: boolean;
    }>;

    const checked = actions.find((a) => a.id === initialAction.id);
    expect(checked).toMatchObject({ origin: "ANALYSE", done: true });

    const manual = actions.find((a) => a.id === manualActionId);
    expect(manual).toMatchObject({ origin: "MANUEL", title: "Ajoutée à la main" });

    const newFromReanalysis = actions.find((a) => a.title === "Action IA (nouvelle analyse)");
    expect(newFromReanalysis).toBeTruthy();
    expect(newFromReanalysis).toMatchObject({ origin: "ANALYSE", done: false });

    expect(actions).toHaveLength(3);
  });
});
