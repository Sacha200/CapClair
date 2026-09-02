import { afterEach, describe, expect, it, vi } from "vitest";

const { queueCtor, add, remove } = vi.hoisted(() => ({
  queueCtor: vi.fn(),
  add: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("bullmq", () => ({
  Queue: class {
    add = add;
    remove = remove;
    close = vi.fn().mockResolvedValue(undefined);
    constructor(...args: unknown[]) {
      queueCtor(...args);
    }
  },
}));

vi.mock("./connection.js", () => ({ createRedisConnection: () => ({}) }));

import { enqueueAnalysis, ANALYSIS_QUEUE_NAME } from "./analysis.js";

afterEach(() => {
  add.mockClear();
  remove.mockClear();
  queueCtor.mockClear();
});

describe("enqueueAnalysis", () => {
  it("retire l'éventuel job précédent AVANT d'ajouter, sur le jobId = caseFileId", async () => {
    await enqueueAnalysis("case-123");

    // Ordre : remove(jobId) puis add(..., { jobId })
    expect(remove).toHaveBeenCalledWith("case-123");
    expect(add).toHaveBeenCalledWith(
      "analyze",
      { caseFileId: "case-123" },
      expect.objectContaining({ jobId: "case-123" }),
    );
    expect(remove.mock.invocationCallOrder[0]!).toBeLessThan(add.mock.invocationCallOrder[0]!);
  });

  it("un échec de remove (job actif / absent) n'empêche pas l'ajout", async () => {
    remove.mockRejectedValueOnce(new Error("job is locked"));
    await expect(enqueueAnalysis("case-456")).resolves.toBeUndefined();
    expect(add).toHaveBeenCalledOnce();
  });

  it("la file est nommée « analysis »", () => {
    expect(ANALYSIS_QUEUE_NAME).toBe("analysis");
  });
});
