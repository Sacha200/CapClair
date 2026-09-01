/** US-2.2 — Aperçu avant analyse (route authentifiée). */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getApp, sessionCookie } from "../helpers/app.js";
import { readFixture, uploadFixture } from "../helpers/documents.js";
import { createUser } from "../helpers/factories.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";

const prisma = testPrisma();
beforeEach(() => truncateAll(prisma));
afterAll(() => disconnectTestPrisma());

async function loginCookie(remoteAddress: string) {
  const app = await getApp();
  const { email, password } = await createUser(prisma);
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password },
    remoteAddress,
  });
  return sessionCookie(res)!;
}

describe("GET /api/documents/:id/file", () => {
  it("sans cookie → 401 (AC3)", async () => {
    const app = await getApp();
    const cookie = await loginCookie("198.51.100.30");
    const upload = await uploadFixture(app, "sample.pdf", {
      cookie,
      remoteAddress: "198.51.100.30",
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/documents/${upload.json().documentId}/file`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("propriétaire → 200, en-têtes corrects, octets identiques à l'upload (AC1)", async () => {
    const app = await getApp();
    const cookie = await loginCookie("198.51.100.31");
    const bytes = readFixture("sample.pdf");

    const upload = await uploadFixture(app, "sample.pdf", {
      cookie,
      remoteAddress: "198.51.100.31",
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/documents/${upload.json().documentId}/file`,
      headers: { cookie },
      remoteAddress: "198.51.100.31",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toBe("inline");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.rawPayload).toEqual(bytes);
  });
});
