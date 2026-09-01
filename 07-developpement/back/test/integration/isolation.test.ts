/**
 * US-1.5 — Isolation stricte des données.
 *
 * Un compte ne peut lire ni un dossier d'un autre compte, ni aucune de ses 6
 * entités liées. La couche d'accès (`forUser`) renvoie `NotFoundError` (→ 404,
 * jamais 403) pour une ressource d'autrui.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { forUser } from "../../src/server/database/context.js";
import { NotFoundError } from "../../src/lib/errors.js";
import { createUser, seedCaseGraph } from "../helpers/factories.js";
import { disconnectTestPrisma, testPrisma, truncateAll } from "../helpers/testDb.js";

const prisma = testPrisma();

beforeEach(() => truncateAll(prisma));
afterAll(() => disconnectTestPrisma());

describe("forUser — isolation par userId", () => {
  it("le propriétaire lit son dossier et ses 6 entités liées ; un tiers reçoit NotFound", async () => {
    const { user: alice } = await createUser(prisma);
    const { user: bob } = await createUser(prisma);
    const graph = await seedCaseGraph(prisma, alice.id);

    const aliceDb = forUser(alice.id, prisma);
    const bobDb = forUser(bob.id, prisma);

    const cases: Array<[string, (id: string) => Promise<unknown>, (id: string) => Promise<unknown>, string]> = [
      ["caseFile", (id) => aliceDb.caseFiles.findByIdForUser(id), (id) => bobDb.caseFiles.findByIdForUser(id), graph.caseFile.id],
      ["document", (id) => aliceDb.documents.findByIdForUser(id), (id) => bobDb.documents.findByIdForUser(id), graph.document.id],
      ["extractedInfo", (id) => aliceDb.extractedInfos.findByIdForUser(id), (id) => bobDb.extractedInfos.findByIdForUser(id), graph.extractedInfo.id],
      ["actionItem", (id) => aliceDb.actionItems.findByIdForUser(id), (id) => bobDb.actionItems.findByIdForUser(id), graph.actionItem.id],
      ["requiredDoc", (id) => aliceDb.requiredDocs.findByIdForUser(id), (id) => bobDb.requiredDocs.findByIdForUser(id), graph.requiredDoc.id],
      ["responseDraft", (id) => aliceDb.responseDrafts.findByIdForUser(id), (id) => bobDb.responseDrafts.findByIdForUser(id), graph.responseDraft.id],
      ["reminder", (id) => aliceDb.reminders.findByIdForUser(id), (id) => bobDb.reminders.findByIdForUser(id), graph.reminder.id],
    ];

    for (const [name, ownerRead, otherRead, id] of cases) {
      await expect(ownerRead(id), `${name}: le propriétaire doit lire sa ligne`).resolves.toBeTruthy();

      let leaked = false;
      try {
        await otherRead(id);
        leaked = true;
      } catch (err) {
        expect(err, `${name}: doit lever NotFoundError`).toBeInstanceOf(NotFoundError);
        expect((err as NotFoundError).status, `${name}: statut 404, pas 403`).toBe(404);
      }
      expect(leaked, `FUITE cross-tenant sur ${name}`).toBe(false);
    }
  });

  it("un identifiant inexistant est aussi un NotFound (aucune divulgation)", async () => {
    const { user } = await createUser(prisma);
    await expect(forUser(user.id, prisma).caseFiles.findByIdForUser("inexistant")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
