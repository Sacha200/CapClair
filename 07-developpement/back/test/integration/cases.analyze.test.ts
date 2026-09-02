/**
 * US-3.1 AC3 / D8 — Déclenchement de l'analyse. IPs : 198.51.100.94 à .97.
 *
 * La file BullMQ est mockée : ce fichier teste la ROUTE (garde de consentement,
 * conflit d'état, code 202), pas le worker — voir `analysis.worker.test.ts`.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/queues/analysis.js", () => ({
  ANALYSIS_QUEUE_NAME: "analysis",
  enqueueAnalysis: vi.fn().mockResolvedValue(undefined),
  analysisQueue: vi.fn(),
  closeAnalysisQueue: vi.fn().mockResolvedValue(undefined),
}));

import { getApp, sessionCookie } from "../helpers/app.js";
import { uploadFixture } from "../helpers/documents.js";
import { createUser } from "../helpers/factories.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";
import { enqueueAnalysis } from "../../src/server/queues/analysis.js";

const prisma = testPrisma();
const enqueueMock = vi.mocked(enqueueAnalysis);

beforeEach(async () => {
  await truncateAll(prisma);
  enqueueMock.mockClear();
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

async function uploadCase(cookie: string, remoteAddress: string): Promise<string> {
  const res = await uploadFixture(await getApp(), "courrier-1p.pdf", { cookie, remoteAddress });
  return res.json().caseFileId as string;
}

function analyser(cookie: string, id: string, remoteAddress: string) {
  return getApp().then((app) =>
    app.inject({
      method: "POST",
      url: `/api/dossiers/${id}/analyser`,
      headers: { cookie },
      remoteAddress,
    }),
  );
}

function consentAi(cookie: string, id: string, remoteAddress: string) {
  return getApp().then((app) =>
    app.inject({
      method: "POST",
      url: `/api/dossiers/${id}/consentement-ia`,
      headers: { cookie },
      payload: { confirmed: true },
      remoteAddress,
    }),
  );
}

describe("POST /api/dossiers/:id/analyser", () => {
  it("403 sans consentement AI_PROCESSING — rien n'est enfilé (AC3)", async () => {
    const { cookie } = await loginUser("198.51.100.94");
    const caseFileId = await uploadCase(cookie, "198.51.100.94");

    const res = await analyser(cookie, caseFileId, "198.51.100.94");
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("consent_required");
    expect(enqueueMock).not.toHaveBeenCalled();

    const caseFile = await prisma.caseFile.findUniqueOrThrow({ where: { id: caseFileId } });
    expect(caseFile.analysisStatus).toBe("EN_ATTENTE");
  });

  it("202 + EN_ATTENTE avec consentement — enfile une fois l'id du dossier", async () => {
    const { cookie } = await loginUser("198.51.100.95");
    const caseFileId = await uploadCase(cookie, "198.51.100.95");
    await consentAi(cookie, caseFileId, "198.51.100.95");

    const res = await analyser(cookie, caseFileId, "198.51.100.95");
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ analysisStatus: "EN_ATTENTE" });
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock).toHaveBeenCalledWith(caseFileId);
  });

  it("409 si l'analyse est déjà EN_COURS ou TERMINEE", async () => {
    const { cookie } = await loginUser("198.51.100.96");
    const caseFileId = await uploadCase(cookie, "198.51.100.96");
    await consentAi(cookie, caseFileId, "198.51.100.96");

    for (const status of ["EN_COURS", "TERMINEE"] as const) {
      await prisma.caseFile.update({
        where: { id: caseFileId },
        data: { analysisStatus: status },
      });
      const res = await analyser(cookie, caseFileId, "198.51.100.96");
      expect(res.statusCode, `statut ${status}`).toBe(409);
      expect(res.json().code).toBe("analysis_conflict");
    }
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("relance autorisée après un ECHEC (repositionne EN_ATTENTE)", async () => {
    const { cookie } = await loginUser("198.51.100.97");
    const caseFileId = await uploadCase(cookie, "198.51.100.97");
    await consentAi(cookie, caseFileId, "198.51.100.97");
    await prisma.caseFile.update({
      where: { id: caseFileId },
      data: { analysisStatus: "ECHEC" },
    });

    const res = await analyser(cookie, caseFileId, "198.51.100.97");
    expect(res.statusCode).toBe(202);
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock).toHaveBeenCalledWith(caseFileId);
    const caseFile = await prisma.caseFile.findUniqueOrThrow({ where: { id: caseFileId } });
    expect(caseFile.analysisStatus).toBe("EN_ATTENTE");
  });

  it("cross-compte → 404", async () => {
    const alice = await loginUser("198.51.100.94");
    const bob = await loginUser("198.51.100.95");
    const caseFileId = await uploadCase(alice.cookie, "198.51.100.94");

    const res = await analyser(bob.cookie, caseFileId, "198.51.100.95");
    expect(res.statusCode).toBe(404);
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});
