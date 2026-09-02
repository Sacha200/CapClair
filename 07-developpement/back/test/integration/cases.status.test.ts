/**
 * `GET /api/dossiers/:id` — consulté en polling (2 s) par l'écran 04.
 * Régression : cette route ne doit PAS porter le preset `RATE_LIMITS.analysis`
 * (10/min), qui couperait le polling au bout de ~20 s. IPs : 198.51.100.98/99.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getApp, sessionCookie } from "../helpers/app.js";
import { uploadFixture } from "../helpers/documents.js";
import { createUser } from "../helpers/factories.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";

const prisma = testPrisma();
beforeEach(() => truncateAll(prisma));
afterAll(() => disconnectTestPrisma());

async function loginAndUpload(remoteAddress: string) {
  const app = await getApp();
  const user = await createUser(prisma);
  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: user.email, password: user.password },
    remoteAddress,
  });
  const cookie = sessionCookie(login)!;
  const upload = await uploadFixture(app, "courrier-1p.pdf", { cookie, remoteAddress });
  return { cookie, caseFileId: upload.json().caseFileId as string };
}

describe("GET /api/dossiers/:id (polling)", () => {
  it("supporte un grand nombre d'appels rapprochés (pas de plafond serré)", async () => {
    const app = await getApp();
    const { cookie, caseFileId } = await loginAndUpload("198.51.100.98");

    // 25 lectures d'affilée : au-delà de RATE_LIMIT_ANALYSIS_MAX (10) — toutes
    // doivent passer (seul le plafond global, très large, s'applique).
    const statuses = await Promise.all(
      Array.from({ length: 25 }, () =>
        app
          .inject({
            method: "GET",
            url: `/api/dossiers/${caseFileId}`,
            headers: { cookie },
            remoteAddress: "198.51.100.98",
          })
          .then((r) => r.statusCode),
      ),
    );

    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  it("cross-compte → 404", async () => {
    const app = await getApp();
    const alice = await loginAndUpload("198.51.100.98");
    const bob = await loginAndUpload("198.51.100.99");

    const res = await app.inject({
      method: "GET",
      url: `/api/dossiers/${alice.caseFileId}`,
      headers: { cookie: bob.cookie },
      remoteAddress: "198.51.100.99",
    });
    expect(res.statusCode).toBe(404);
  });
});
