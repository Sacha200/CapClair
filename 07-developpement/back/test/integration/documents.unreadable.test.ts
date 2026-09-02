/**
 * US-2.6 — Barrière « document illisible » (< 100 caractères utiles) :
 * l'import réussit mais l'analyse n'est pas amorcée. IPs : 198.51.100.60/.61.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getApp, sessionCookie } from "../helpers/app.js";
import { uploadFixture } from "../helpers/documents.js";
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

describe("barrière illisible (US-2.6 AC1/AC3)", () => {
  it("PDF sans texte exploitable → 201 readable:false, dossier non amorcé, aucun consentement IA", async () => {
    const app = await getApp();
    const cookie = await loginCookie("198.51.100.60");

    const res = await uploadFixture(app, "scanne-vide.pdf", {
      cookie,
      remoteAddress: "198.51.100.60",
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.readable).toBe(false);
    expect(body.extractedTextLength).toBeLessThan(100);

    // Le peu de texte trouvé est conservé (diagnostic), mais rien n'est amorcé :
    // pas d'appel IA (structurel : aucun enfilement dans features/documents),
    // pas de consentement, statut d'analyse inchangé.
    const caseFile = await prisma.caseFile.findUniqueOrThrow({ where: { id: body.caseFileId } });
    expect(caseFile.analysisStatus).toBe("EN_ATTENTE");
    expect(await prisma.consentLog.count()).toBe(0);
    expect(await prisma.extractedInformation.count()).toBe(0);
  });

  it("image (PNG) → 201 readable:false sans plantage (US-2.5 coupée → parcours illisible)", async () => {
    const app = await getApp();
    const cookie = await loginCookie("198.51.100.61");

    const res = await uploadFixture(app, "pixel.png", {
      cookie,
      remoteAddress: "198.51.100.61",
      filename: "photo.png",
      contentType: "image/png",
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      kind: "image",
      readable: false,
      extractedTextLength: 0,
    });
    expect(res.json().pageCount).toBeUndefined();
  });
});
