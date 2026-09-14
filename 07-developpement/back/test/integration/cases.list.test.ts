/**
 * `GET /api/dossiers` — liste des dossiers + résumé du tableau de bord (E5, US-5.4).
 *
 * 200 même pour un compte sans dossier (liste + résumé à zéro). Le résumé ne
 * porte que sur les dossiers actifs (`status !== "TERMINE"`), sauf
 * `recentAnalyses` qui inclut tout dossier `analysisStatus: "TERMINEE"`, actif
 * ou non. Aucune fuite cross-compte (dossiers, actions, notifications).
 * IPs : 198.51.100.120 à .124.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { CaseFileListResponseSchema } from "@capclair/contract";
import { getApp, sessionCookie } from "../helpers/app.js";
import { createUser } from "../helpers/factories.js";
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

function listCases(cookie: string | undefined, remoteAddress: string) {
  return getApp().then((app) =>
    app.inject({
      method: "GET",
      url: "/api/dossiers",
      headers: cookie ? { cookie } : {},
      remoteAddress,
    }),
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe("GET /api/dossiers", () => {
  it("401 sans session", async () => {
    const res = await listCases(undefined, "198.51.100.120");
    expect(res.statusCode).toBe(401);
  });

  it("compte sans dossier → 200, liste et résumé à zéro", async () => {
    const { cookie } = await loginUser("198.51.100.120");

    const res = await listCases(cookie, "198.51.100.120");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      cases: [],
      summary: {
        activeCount: 0,
        deadlineWithin7DaysCount: 0,
        remainingActionsCount: 0,
        recentAnalyses: [],
        recentNotifications: [],
      },
    });
  });

  it("compteurs : actifs, échéances sous 7 jours, actions restantes (dossier TERMINE exclu)", async () => {
    const { cookie, userId } = await loginUser("198.51.100.121");
    const now = Date.now();

    // Actif, échéance dans 3 jours (< 7j) — 1 action faite, 1 non faite.
    await prisma.caseFile.create({
      data: {
        userId,
        organisme: "CAF",
        title: "Dossier proche",
        status: "ACTION_REQUISE",
        analysisStatus: "TERMINEE",
        mainDeadline: new Date(now + 3 * DAY_MS),
        lastActivityAt: new Date(now),
        actionItems: {
          create: [
            { title: "Action faite", sourceExcerpt: "…", done: true },
            { title: "Action à faire", sourceExcerpt: "…", done: false },
          ],
        },
      },
    });

    // Actif, échéance dans 10 jours (> 7j) — 1 action non faite.
    await prisma.caseFile.create({
      data: {
        userId,
        organisme: "CPAM",
        title: "Dossier lointain",
        status: "DOCUMENTS_A_PREPARER",
        analysisStatus: "EN_ATTENTE",
        mainDeadline: new Date(now + 10 * DAY_MS),
        lastActivityAt: new Date(now - 1000),
        actionItems: { create: [{ title: "Autre action", sourceExcerpt: "…", done: false }] },
      },
    });

    // TERMINE — échéance proche, actions non faites : ne doit compter nulle part.
    await prisma.caseFile.create({
      data: {
        userId,
        organisme: "FRANCE_TRAVAIL",
        title: "Dossier clos",
        status: "TERMINE",
        analysisStatus: "TERMINEE",
        mainDeadline: new Date(now + 1 * DAY_MS),
        lastActivityAt: new Date(now - 2000),
        actionItems: { create: [{ title: "Action ignorée", sourceExcerpt: "…", done: false }] },
      },
    });

    const res = await listCases(cookie, "198.51.100.121");
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(() => CaseFileListResponseSchema.parse(body)).not.toThrow();
    expect(body.cases).toHaveLength(3);
    expect(body.summary.activeCount).toBe(2);
    expect(body.summary.deadlineWithin7DaysCount).toBe(1);
    // 1 (dossier proche) + 1 (dossier lointain) actions non faites, dossiers actifs seulement.
    expect(body.summary.remainingActionsCount).toBe(2);

    const proche = body.cases.find((c: { title: string }) => c.title === "Dossier proche");
    expect(proche).toMatchObject({ actionsTotal: 2, actionsRemaining: 1 });
  });

  it("recentAnalyses : uniquement TERMINEE, tri du plus récent au plus ancien, plafonné à 5", async () => {
    const { cookie, userId } = await loginUser("198.51.100.122");
    const now = Date.now();

    // 6 dossiers TERMINEE, horodatages distincts et décroissants.
    for (let i = 0; i < 6; i += 1) {
      await prisma.caseFile.create({
        data: {
          userId,
          organisme: "CAF",
          title: `Analyse ${i}`,
          status: "TERMINE",
          analysisStatus: "TERMINEE",
          lastActivityAt: new Date(now - i * 1000),
        },
      });
    }
    // 1 dossier non terminé — ne doit jamais apparaître dans recentAnalyses.
    await prisma.caseFile.create({
      data: {
        userId,
        organisme: "CAF",
        title: "Pas encore analysé",
        analysisStatus: "EN_ATTENTE",
        lastActivityAt: new Date(now + 1000),
      },
    });

    const res = await listCases(cookie, "198.51.100.122");
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.summary.recentAnalyses).toHaveLength(5);
    expect(body.summary.recentAnalyses.map((a: { title: string }) => a.title)).toEqual([
      "Analyse 0",
      "Analyse 1",
      "Analyse 2",
      "Analyse 3",
      "Analyse 4",
    ]);
    expect(
      body.summary.recentAnalyses.every(
        (a: { analysisStatus: string }) => a.analysisStatus === "TERMINEE",
      ),
    ).toBe(true);
  });

  it("aucune fuite cross-compte (dossiers et notifications)", async () => {
    const alice = await loginUser("198.51.100.123");
    const bob = await loginUser("198.51.100.124");

    await prisma.caseFile.create({
      data: { userId: bob.userId, organisme: "CAF", title: "Dossier de Bob" },
    });
    await prisma.notification.create({
      data: {
        userId: bob.userId,
        type: "ANALYSE_TERMINEE",
        title: "Notification de Bob",
        body: "…",
      },
    });
    await prisma.caseFile.create({
      data: { userId: alice.userId, organisme: "CAF", title: "Dossier d'Alice" },
    });
    await prisma.notification.create({
      data: {
        userId: alice.userId,
        type: "ANALYSE_TERMINEE",
        title: "Notification d'Alice",
        body: "…",
      },
    });

    const res = await listCases(alice.cookie, "198.51.100.123");
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.cases).toHaveLength(1);
    expect(body.cases[0].title).toBe("Dossier d'Alice");
    expect(body.summary.recentNotifications).toHaveLength(1);
    expect(body.summary.recentNotifications[0].title).toBe("Notification d'Alice");

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("Bob");
  });
});
