/** US-2.4 — Extraction du texte d'un PDF à l'import. IP dédiée : 198.51.100.50. */
import { readdirSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DOCUMENT_MESSAGES } from "@capclair/contract";
import { env } from "../../src/env.js";
import { getApp, sessionCookie } from "../helpers/app.js";
import { uploadFixture } from "../helpers/documents.js";
import { createUser } from "../helpers/factories.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";

const IP = "198.51.100.50";
const prisma = testPrisma();
beforeEach(() => truncateAll(prisma));
afterAll(() => disconnectTestPrisma());

async function loginCookie() {
  const app = await getApp();
  const { email, password } = await createUser(prisma);
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password },
    remoteAddress: IP,
  });
  return sessionCookie(res)!;
}

describe("POST /api/documents — extraction PDF", () => {
  it("PDF lisible → texte extrait stocké (date, montant, référence), hash, < 5 s bout en bout (AC1/AC2/AC4)", async () => {
    const app = await getApp();
    const cookie = await loginCookie();

    const start = performance.now();
    const res = await uploadFixture(app, "courrier-1p.pdf", { cookie, remoteAddress: IP });
    const elapsed = performance.now() - start;

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({ kind: "pdf", pageCount: 1, readable: true });
    expect(body.extractedTextLength).toBeGreaterThanOrEqual(100);
    expect(elapsed).toBeLessThan(5000);

    const doc = await prisma.document.findUniqueOrThrow({ where: { id: body.documentId } });
    expect(doc.extractedText).toContain("15 septembre 2026");
    expect(doc.extractedText).toContain("128,50");
    expect(doc.extractedText).toContain("0847213C");
    expect(doc.extractedTextHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("PDF de plus de 10 pages → 422 message exact, aucune écriture (AC3, ADR-014)", async () => {
    const app = await getApp();
    const cookie = await loginCookie();
    const filesBefore = readdirSync(env.STORAGE_DIR).length;

    const res = await uploadFixture(app, "many-pages.pdf", { cookie, remoteAddress: IP });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({
      error: DOCUMENT_MESSAGES.tooManyPages,
      code: "too_many_pages",
    });
    expect(await prisma.caseFile.count()).toBe(0);
    expect(await prisma.document.count()).toBe(0);
    expect(readdirSync(env.STORAGE_DIR).length).toBe(filesBefore);
  });
});
