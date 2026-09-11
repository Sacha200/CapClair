import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCaseHistory = vi.fn();
vi.mock("@/lib/api/cases", () => ({
  getCaseHistory: (...args: unknown[]) => getCaseHistory(...args),
}));

import { CaseHistory } from "./case-history";

/** Laisse le fetch mocké + le setState de l'effet se résoudre dans `act`. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("CaseHistory (US-4.5)", () => {
  beforeEach(() => getCaseHistory.mockReset());

  it("rend une liste ordonnée des libellés, avec horodatage", async () => {
    getCaseHistory.mockResolvedValue({
      entries: [
        { id: "11111111-1111-4111-8111-111111111111", at: "2026-07-02T14:00:00.000Z", label: "Information corrigée" },
        { id: "22222222-2222-4222-8222-222222222222", at: "2026-07-01T09:00:00.000Z", label: "Courrier importé" },
      ],
    });

    render(<CaseHistory caseFileId="c1" />);

    expect(await screen.findByText("Information corrigée")).toBeInTheDocument();
    expect(screen.getByText("Courrier importé")).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("liste vide → ne rend rien (section secondaire)", async () => {
    getCaseHistory.mockResolvedValue({ entries: [] });
    const { container } = render(<CaseHistory caseFileId="c1" />);
    await flush();
    expect(getCaseHistory).toHaveBeenCalledWith("c1");
    expect(container).toBeEmptyDOMElement();
  });

  it("historique indisponible (fetch non résolu) → ne rend rien", async () => {
    // Promesse contrôlée plutôt que `new Promise(() => {})` : une promesse
    // jamais réglée laisse un handle ouvert (React/jsdom) qui empêche le
    // process vitest de se terminer une fois tous les tests passés (hang en
    // CI, cf. écran 05 / E4 — vu sur run GitHub Actions le 2026-09-10).
    let resolvePending!: (value: { entries: [] }) => void;
    getCaseHistory.mockReturnValue(
      new Promise<{ entries: [] }>((resolve) => {
        resolvePending = resolve;
      }),
    );
    const { container } = render(<CaseHistory caseFileId="c1" />);
    await flush();
    expect(getCaseHistory).toHaveBeenCalledWith("c1");
    expect(container).toBeEmptyDOMElement();
    // Règle la promesse pour ne rien laisser en suspens à la fin du test.
    resolvePending({ entries: [] });
    await flush();
  });
});
