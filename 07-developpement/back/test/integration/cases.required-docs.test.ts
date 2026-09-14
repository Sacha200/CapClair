/**
 * `PATCH /api/dossiers/:id/justificatifs/:docId` — checklist des justificatifs
 * (E5, US-5.3 AC1/AC2) : coche « fourni » et/ou pose une note libre.
 *
 * Pas d'`AuditEvent` pour ce verbe (aucune AC US-5.3 ne le demande). 404
 * cross-dossier/cross-compte. 400 si aucune des deux clés, ou note > 500
 * caractères. Un justificatif `provided: true` ou porteur d'une `userNote`
 * survit à une ré-analyse (protection posée en Task 1, vérifiée ici au niveau
 * HTTP maintenant que la route existe). IPs : 198.51.100.170 à .179.
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

function patchDoc(
  cookie: string | undefined,
  id: string,
  docId: string,
  body: Record<string, unknown>,
  remoteAddress: string,
) {
  return getApp().then((app) =>
    app.inject({
      method: "PATCH",
      url: `/api/dossiers/${id}/justificatifs/${docId}`,
      headers: cookie ? { cookie } : {},
      payload: body,
      remoteAddress,
    }),
  );
}

function getResult(cookie: string, id: string, remoteAddress: string) {
  return getApp().then((app) =>
    app.inject({
      method: "GET",
      url: `/api/dossiers/${id}/resultat`,
      headers: { cookie },
      remoteAddress,
    }),
  );
}

async function seedTerminatedCase(userId: string) {
  return seedCaseGraph(prisma, userId, { analysisStatus: "TERMINEE" });
}

describe("PATCH /api/dossiers/:id/justificatifs/:docId", () => {
  it("401 sans session", async () => {
    const res = await patchDoc(
      undefined,
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      { provided: true },
      "198.51.100.170",
    );
    expect(res.statusCode).toBe(401);
  });

  it("provided: true → 200 ; GET …/resultat reflète provided: true", async () => {
    const { cookie, userId } = await loginUser("198.51.100.171");
    const { caseFile, requiredDoc } = await seedTerminatedCase(userId);

    const res = await patchDoc(
      cookie,
      caseFile.id,
      requiredDoc.id,
      { provided: true },
      "198.51.100.171",
    );
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const result = await getResult(cookie, caseFile.id, "198.51.100.171");
    const doc = result.json().requiredDocuments.find((d: { id: string }) => d.id === requiredDoc.id);
    expect(doc.provided).toBe(true);
  });

  it("userNote fournie → 200 ; reflétée en lecture", async () => {
    const { cookie, userId } = await loginUser("198.51.100.172");
    const { caseFile, requiredDoc } = await seedTerminatedCase(userId);

    const res = await patchDoc(
      cookie,
      caseFile.id,
      requiredDoc.id,
      { userNote: "Demandé un duplicata à la banque" },
      "198.51.100.172",
    );
    expect(res.statusCode).toBe(200);

    const result = await getResult(cookie, caseFile.id, "198.51.100.172");
    const doc = result.json().requiredDocuments.find((d: { id: string }) => d.id === requiredDoc.id);
    expect(doc.userNote).toBe("Demandé un duplicata à la banque");
  });

  it("userNote > 500 caractères → 400", async () => {
    const { cookie, userId } = await loginUser("198.51.100.173");
    const { caseFile, requiredDoc } = await seedTerminatedCase(userId);

    const res = await patchDoc(
      cookie,
      caseFile.id,
      requiredDoc.id,
      { userNote: "x".repeat(501) },
      "198.51.100.173",
    );
    expect(res.statusCode).toBe(400);
  });

  it("corps vide (aucune clé) → 400", async () => {
    const { cookie, userId } = await loginUser("198.51.100.174");
    const { caseFile, requiredDoc } = await seedTerminatedCase(userId);

    const res = await patchDoc(cookie, caseFile.id, requiredDoc.id, {}, "198.51.100.174");
    expect(res.statusCode).toBe(400);
  });

  it("docId d'un autre dossier / d'un autre compte → 404", async () => {
    const alice = await loginUser("198.51.100.175");
    const bob = await loginUser("198.51.100.176");
    const aliceCase = await seedTerminatedCase(alice.userId);
    const bobCase = await seedTerminatedCase(bob.userId);

    const wrongCase = await patchDoc(
      bob.cookie,
      bobCase.caseFile.id,
      aliceCase.requiredDoc.id,
      { provided: true },
      "198.51.100.176",
    );
    expect(wrongCase.statusCode).toBe(404);

    const crossAccount = await patchDoc(
      bob.cookie,
      aliceCase.caseFile.id,
      aliceCase.requiredDoc.id,
      { provided: true },
      "198.51.100.176",
    );
    expect(crossAccount.statusCode).toBe(404);
  });
});

describe("justificatifs traités : survivent à une ré-analyse (US-5.3, protection Task 1)", () => {
  function newAnalysisResult(): AnalysisResult {
    return {
      organisme: "CAF",
      typeCourrier: "Demande de pièces justificatives",
      dateCourrierRawText: null,
      informationsExtraites: [],
      resume: "La CAF vous demande un nouveau justificatif.",
      actions: [],
      justificatifs: [{ name: "Justificatif IA (nouvelle analyse)", sourceExcerpt: "…" }],
      echeancePrincipale: null,
      brouillonReponse: "Madame, Monsieur, …",
      avertissements: [],
    };
  }

  it("provided: true survit ; userNote non vide survit ; non traité est remplacé", async () => {
    const REMOTE = "198.51.100.177";
    const { cookie, userId } = await loginUser(REMOTE);
    const { caseFile, requiredDoc: providedDoc } = await seedCaseGraph(prisma, userId, {
      analysisStatus: "TERMINEE",
      extractedText: "Caisse d'Allocations Familiales. Merci de nous transmettre un justificatif.",
    });
    // Second justificatif, traité via une note plutôt que "fourni".
    const notedDoc = await prisma.requiredDocument.create({
      data: { caseFileId: caseFile.id, name: "Autre justificatif", sourceExcerpt: "…" },
    });
    // Troisième justificatif, jamais traité (provided: false, userNote: null,
    // valeurs par défaut) : celui-ci NE doit PAS survivre à la ré-analyse.
    const untouchedDoc = await prisma.requiredDocument.create({
      data: { caseFileId: caseFile.id, name: "Jamais traité", sourceExcerpt: "…" },
    });
    expect(untouchedDoc.provided).toBe(false);
    expect(untouchedDoc.userNote).toBeNull();

    const app = await getApp();

    const provideRes = await patchDoc(
      cookie,
      caseFile.id,
      providedDoc.id,
      { provided: true },
      REMOTE,
    );
    expect(provideRes.statusCode).toBe(200);

    const noteRes = await patchDoc(
      cookie,
      caseFile.id,
      notedDoc.id,
      { userNote: "Déjà envoyé par courrier" },
      REMOTE,
    );
    expect(noteRes.statusCode).toBe(200);

    analyzeLetterMock.mockResolvedValue({ result: newAnalysisResult() });
    await runAnalysisJob(caseFile.id);

    const result = await app.inject({
      method: "GET",
      url: `/api/dossiers/${caseFile.id}/resultat`,
      headers: { cookie },
      remoteAddress: REMOTE,
    });
    expect(result.statusCode).toBe(200);
    const docs = result.json().requiredDocuments as Array<{
      id: string;
      name: string;
      provided: boolean;
      userNote: string | null;
    }>;

    const survivedProvided = docs.find((d) => d.id === providedDoc.id);
    expect(survivedProvided).toMatchObject({ provided: true });

    const survivedNoted = docs.find((d) => d.id === notedDoc.id);
    expect(survivedNoted).toMatchObject({ userNote: "Déjà envoyé par courrier" });

    // Le justificatif jamais traité doit avoir disparu (remplacé, pas conservé).
    expect(docs.find((d) => d.id === untouchedDoc.id)).toBeUndefined();

    const newFromReanalysis = docs.find((d) => d.name === "Justificatif IA (nouvelle analyse)");
    expect(newFromReanalysis).toBeTruthy();

    expect(docs).toHaveLength(3);
  });
});
