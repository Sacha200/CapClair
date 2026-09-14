import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseFileListItem, DashboardSummary } from "@capclair/contract";

const listCases = vi.fn();

vi.mock("@/lib/api/cases", () => ({
  listCases: (...args: unknown[]) => listCases(...args),
}));
vi.mock("@/lib/session", () => ({ readCookieHeader: () => Promise.resolve("capclair_session=x") }));

import DashboardPage from "./page";

const EMPTY_SUMMARY: DashboardSummary = {
  activeCount: 0,
  deadlineWithin7DaysCount: 0,
  remainingActionsCount: 0,
  recentAnalyses: [],
  recentNotifications: [],
};

function makeCase(overrides: Partial<CaseFileListItem> = {}): CaseFileListItem {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Demande de justificatifs",
    organisme: "CAF",
    status: "ACTION_REQUISE",
    analysisStatus: "TERMINEE",
    mainDeadline: null,
    actionsRemaining: 1,
    actionsTotal: 2,
    lastActivityAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("DashboardPage (US-5.4)", () => {
  beforeEach(() => {
    listCases.mockReset();
  });

  it("AC3 — aucun dossier → état vide (texte + bouton d'import)", async () => {
    listCases.mockResolvedValue({ cases: [], summary: EMPTY_SUMMARY });
    render(await DashboardPage());

    expect(screen.getByRole("heading", { level: 1, name: "Mes dossiers" })).toBeInTheDocument();
    expect(
      screen.getByText(/vous n'avez pas encore de dossier/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /importer un courrier/i })).toBeInTheDocument();
  });

  it("dossiers présents → tuiles + résumé rendus, bouton d'import toujours visible", async () => {
    listCases.mockResolvedValue({
      cases: [makeCase()],
      summary: { ...EMPTY_SUMMARY, activeCount: 1 },
    });
    render(await DashboardPage());

    expect(screen.getByText("Demande de justificatifs")).toBeInTheDocument();
    expect(screen.getByText("Dossiers actifs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /importer un courrier/i })).toBeInTheDocument();
  });
});
