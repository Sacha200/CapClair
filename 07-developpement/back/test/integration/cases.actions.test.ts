/**
 * `POST/PATCH/DELETE /api/dossiers/:id/actions[/:actionId]` — actions du
 * dossier : cocher, ajouter, supprimer (E5, US-5.2).
 *
 * POST crée une action `origin: "MANUEL"` (`sourceExcerpt`/`verifiable` `null`
 * — pas d'extrait à vérifier, ce n'est pas la même chose qu'un extrait non
 * retrouvé). PATCH coche/décoche (`AuditEvent action.completed`/
 * `action.reopened`, `metadata: { actionId }`). DELETE supprime définitivement
 * (`AuditEvent action.deleted`). 404 cross-dossier/cross-compte pour les trois
 * verbes. 400 sur titre vide/trop long. IPs : 198.51.100.150 à .159.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getApp, sessionCookie } from "../helpers/app.js";
import { createUser, seedCaseGraph } from "../helpers/factories.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";

const prisma = testPrisma();
beforeEach(() => truncateAll(prisma));
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

function postAction(
  cookie: string | undefined,
  id: string,
  body: Record<string, unknown>,
  remoteAddress: string,
) {
  return getApp().then((app) =>
    app.inject({
      method: "POST",
      url: `/api/dossiers/${id}/actions`,
      headers: cookie ? { cookie } : {},
      payload: body,
      remoteAddress,
    }),
  );
}

function patchAction(
  cookie: string,
  id: string,
  actionId: string,
  body: Record<string, unknown>,
  remoteAddress: string,
) {
  return getApp().then((app) =>
    app.inject({
      method: "PATCH",
      url: `/api/dossiers/${id}/actions/${actionId}`,
      headers: { cookie },
      payload: body,
      remoteAddress,
    }),
  );
}

function deleteAction(cookie: string, id: string, actionId: string, remoteAddress: string) {
  return getApp().then((app) =>
    app.inject({
      method: "DELETE",
      url: `/api/dossiers/${id}/actions/${actionId}`,
      headers: { cookie },
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

describe("POST /api/dossiers/:id/actions", () => {
  it("401 sans session", async () => {
    const res = await postAction(
      undefined,
      "11111111-1111-1111-1111-111111111111",
      { title: "Une action" },
      "198.51.100.150",
    );
    expect(res.statusCode).toBe(401);
  });

  it("crée une action MANUEL sans extrait ; GET …/resultat la montre (AC2)", async () => {
    const { cookie, userId } = await loginUser("198.51.100.150");
    const { caseFile } = await seedTerminatedCase(userId);

    const res = await postAction(
      cookie,
      caseFile.id,
      { title: "Appeler la CAF" },
      "198.51.100.150",
    );
    expect(res.statusCode).toBe(201);
    const { id } = res.json();
    expect(typeof id).toBe("string");

    const result = await getResult(cookie, caseFile.id, "198.51.100.150");
    expect(result.statusCode).toBe(200);
    const added = result.json().actions.find((a: { id: string }) => a.id === id);
    expect(added).toMatchObject({
      title: "Appeler la CAF",
      origin: "MANUEL",
      sourceExcerpt: null,
      verifiable: null,
      description: null,
      done: false,
    });
  });

  it("description fournie → reprise telle quelle", async () => {
    const { cookie, userId } = await loginUser("198.51.100.151");
    const { caseFile } = await seedTerminatedCase(userId);

    const res = await postAction(
      cookie,
      caseFile.id,
      { title: "Envoyer le RIB", description: "Le RIB doit être au nom du demandeur." },
      "198.51.100.151",
    );
    expect(res.statusCode).toBe(201);

    const result = await getResult(cookie, caseFile.id, "198.51.100.151");
    const added = result.json().actions.find((a: { id: string }) => a.id === res.json().id);
    expect(added.description).toBe("Le RIB doit être au nom du demandeur.");
  });

  it("titre vide → 400 ; titre > 120 caractères → 400", async () => {
    const { cookie, userId } = await loginUser("198.51.100.152");
    const { caseFile } = await seedTerminatedCase(userId);

    const empty = await postAction(cookie, caseFile.id, { title: "   " }, "198.51.100.152");
    expect(empty.statusCode).toBe(400);

    const tooLong = await postAction(
      cookie,
      caseFile.id,
      { title: "x".repeat(121) },
      "198.51.100.152",
    );
    expect(tooLong.statusCode).toBe(400);
  });

  it("id de dossier d'un autre compte → 404", async () => {
    const alice = await loginUser("198.51.100.153");
    const bob = await loginUser("198.51.100.154");
    const { caseFile } = await seedTerminatedCase(alice.userId);

    const res = await postAction(
      bob.cookie,
      caseFile.id,
      { title: "Action de Bob sur le dossier d'Alice" },
      "198.51.100.154",
    );
    expect(res.statusCode).toBe(404);
  });
});

describe("PATCH /api/dossiers/:id/actions/:actionId", () => {
  it("coche l'action, journalise action.completed", async () => {
    const { cookie, userId } = await loginUser("198.51.100.155");
    const { caseFile, actionItem } = await seedTerminatedCase(userId);

    const res = await patchAction(
      cookie,
      caseFile.id,
      actionItem.id,
      { done: true },
      "198.51.100.155",
    );
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const result = await getResult(cookie, caseFile.id, "198.51.100.155");
    const action = result.json().actions.find((a: { id: string }) => a.id === actionItem.id);
    expect(action.done).toBe(true);

    const events = await prisma.auditEvent.findMany({ where: { caseFileId: caseFile.id } });
    const completed = events.find((e) => e.eventType === "action.completed");
    expect(completed).toBeTruthy();
    expect(completed!.metadata).toEqual({ actionId: actionItem.id });
  });

  it("décoche une action déjà cochée, journalise action.reopened", async () => {
    const { cookie, userId } = await loginUser("198.51.100.156");
    const { caseFile, actionItem } = await seedTerminatedCase(userId);

    await patchAction(cookie, caseFile.id, actionItem.id, { done: true }, "198.51.100.156");
    const res = await patchAction(
      cookie,
      caseFile.id,
      actionItem.id,
      { done: false },
      "198.51.100.156",
    );
    expect(res.statusCode).toBe(200);

    const events = await prisma.auditEvent.findMany({
      where: { caseFileId: caseFile.id, eventType: "action.reopened" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.metadata).toEqual({ actionId: actionItem.id });
  });

  it("actionId d'un autre dossier / d'un autre compte → 404", async () => {
    const alice = await loginUser("198.51.100.157");
    const bob = await loginUser("198.51.100.158");
    const aliceCase = await seedTerminatedCase(alice.userId);
    const bobCase = await seedTerminatedCase(bob.userId);

    const wrongCase = await patchAction(
      bob.cookie,
      bobCase.caseFile.id,
      aliceCase.actionItem.id,
      { done: true },
      "198.51.100.158",
    );
    expect(wrongCase.statusCode).toBe(404);

    const crossAccount = await patchAction(
      bob.cookie,
      aliceCase.caseFile.id,
      aliceCase.actionItem.id,
      { done: true },
      "198.51.100.158",
    );
    expect(crossAccount.statusCode).toBe(404);
  });
});

describe("DELETE /api/dossiers/:id/actions/:actionId", () => {
  it("supprime définitivement, journalise action.deleted", async () => {
    const { cookie, userId } = await loginUser("198.51.100.159");
    const { caseFile, actionItem } = await seedTerminatedCase(userId);

    const res = await deleteAction(cookie, caseFile.id, actionItem.id, "198.51.100.159");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const result = await getResult(cookie, caseFile.id, "198.51.100.159");
    expect(
      result.json().actions.find((a: { id: string }) => a.id === actionItem.id),
    ).toBeUndefined();

    const events = await prisma.auditEvent.findMany({
      where: { caseFileId: caseFile.id, eventType: "action.deleted" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.metadata).toEqual({ actionId: actionItem.id });
  });

  it("actionId d'un autre dossier / d'un autre compte → 404, rien de supprimé", async () => {
    const alice = await loginUser("198.51.100.150");
    const bob = await loginUser("198.51.100.151");
    const aliceCase = await seedTerminatedCase(alice.userId);
    const bobCase = await seedTerminatedCase(bob.userId);

    const wrongCase = await deleteAction(
      bob.cookie,
      bobCase.caseFile.id,
      aliceCase.actionItem.id,
      "198.51.100.151",
    );
    expect(wrongCase.statusCode).toBe(404);

    const crossAccount = await deleteAction(
      bob.cookie,
      aliceCase.caseFile.id,
      aliceCase.actionItem.id,
      "198.51.100.151",
    );
    expect(crossAccount.statusCode).toBe(404);

    const stillThere = await prisma.actionItem.findUnique({ where: { id: aliceCase.actionItem.id } });
    expect(stillThere).not.toBeNull();
  });
});
