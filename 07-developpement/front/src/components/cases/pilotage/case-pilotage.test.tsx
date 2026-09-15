import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeResult } from "@/components/cases/result.fixture";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/api/cases", () => ({
  updateCaseStatus: vi.fn(),
  toggleAction: vi.fn(),
  createAction: vi.fn(),
  deleteAction: vi.fn(),
  updateRequiredDoc: vi.fn(),
  deleteCase: vi.fn(),
}));

import { CasePilotage } from "./case-pilotage";

const CASE_ID = "11111111-1111-4111-8111-111111111111";

describe("CasePilotage — revue de fidélité Figma écran 06 (node 60:261)", () => {
  it("en-tête : titre réel du dossier, badge de statut et sous-titre organisme + date de réception", () => {
    const data = makeResult({
      title: "Demande de justificatifs",
      organisme: "CAF",
      documentDate: "2026-07-03T00:00:00.000Z",
      status: "ACTION_REQUISE",
    });
    const { container } = render(<CasePilotage data={data} caseFileId={CASE_ID} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Demande de justificatifs" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/CAF · reçu le 3 juillet 2026/)).toBeInTheDocument();

    // Le libellé de statut apparaît aussi comme option du sélecteur (US-5.1
    // AC2) : on cible spécifiquement le badge dans l'en-tête pour éviter une
    // correspondance multiple.
    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).getByText("Action requise")).toBeInTheDocument();
  });

  it("le lien vers le résultat de l'analyse reste présent", () => {
    render(<CasePilotage data={makeResult()} caseFileId={CASE_ID} />);
    expect(
      screen.getByRole("link", { name: "Voir le résultat de l'analyse" }),
    ).toHaveAttribute("href", `/dossiers/${CASE_ID}`);
  });

  it("les 3 sections (statut, actions, justificatifs) sont encapsulées dans des cartes titrées", () => {
    render(<CasePilotage data={makeResult()} caseFileId={CASE_ID} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Statut du dossier" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Actions" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Justificatifs" }),
    ).toBeInTheDocument();
  });
});
