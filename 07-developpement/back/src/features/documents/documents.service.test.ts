import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { env } from "../../env.js";
import * as storage from "../../server/storage/index.js";
import type { UserScopedDb } from "../../server/database/context.js";
import { uploadDocument } from "./documents.service.js";

describe("uploadDocument — atomicité (plan E2 §12.9)", () => {
  it("purge le fichier disque si la création en base échoue (pas d'orphelin)", async () => {
    const deleteSpy = vi.spyOn(storage, "deleteDocument");
    const fakeDb = {
      documents: {
        createWithCase: vi.fn().mockRejectedValue(new Error("échec DB simulé")),
      },
    } as unknown as UserScopedDb;

    const pdfBytes = Buffer.from("%PDF-1.4\ncontenu de test");

    await expect(
      uploadDocument(fakeDb, { buffer: pdfBytes, truncated: false, filename: "x.pdf" }),
    ).rejects.toThrow("échec DB simulé");

    expect(deleteSpy).toHaveBeenCalledTimes(1);
    const [storagePath] = deleteSpy.mock.calls[0]!;
    expect(existsSync(join(env.STORAGE_DIR, storagePath))).toBe(false);

    deleteSpy.mockRestore();
  });
});
