/** US-4.5 AC2 — l'historique n'affiche jamais un `eventType` technique. */
import { describe, expect, it } from "vitest";
import { historyLabel } from "./history-label.js";

const KNOWN_EVENT_TYPES = [
  "document.imported",
  "analysis.completed",
  "analysis.failed",
  "information.corrected",
  "deadline.corrected",
  "case.updated",
  "case.status_changed",
  "action.completed",
  "action.reopened",
  "reminder.sent",
  "case.deleted",
];

describe("historyLabel", () => {
  it("chaque type connu → libellé FR non vide, sans point ni underscore technique", () => {
    for (const eventType of KNOWN_EVENT_TYPES) {
      const label = historyLabel(eventType);
      expect(label).not.toBe(eventType);
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/[._]/);
    }
  });

  it("type inconnu → libellé générique, jamais le code brut", () => {
    expect(historyLabel("foo.bar_baz")).toBe("Modification du dossier");
    expect(historyLabel("")).toBe("Modification du dossier");
  });
});
