import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CaseFileListItem } from "@capclair/contract";
import { CaseFileTile } from "./case-file-tile";

function makeCase(overrides: Partial<CaseFileListItem> = {}): CaseFileListItem {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Demande de justificatifs",
    organisme: "CAF",
    status: "ACTION_REQUISE",
    analysisStatus: "TERMINEE",
    mainDeadline: null,
    actionsRemaining: 2,
    actionsTotal: 3,
    lastActivityAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("CaseFileTile (US-5.4)", () => {
  it("affiche titre, organisme, statut FR et progression des actions", () => {
    render(
      <ul>
        <CaseFileTile caseFile={makeCase()} />
      </ul>,
    );

    expect(screen.getByText("Demande de justificatifs")).toBeInTheDocument();
    expect(screen.getByText("CAF")).toBeInTheDocument();
    expect(screen.getByText("Action requise")).toBeInTheDocument();
    expect(screen.getByText("2 actions restantes")).toBeInTheDocument();
  });

  it("le lien pointe vers /dossiers/<id>", () => {
    render(
      <ul>
        <CaseFileTile caseFile={makeCase({ id: "22222222-2222-4222-8222-222222222222" })} />
      </ul>,
    );

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/dossiers/22222222-2222-4222-8222-222222222222",
    );
  });

  it("aucune action → message dédié, pas de compteur à zéro", () => {
    render(
      <ul>
        <CaseFileTile caseFile={makeCase({ actionsTotal: 0, actionsRemaining: 0 })} />
      </ul>,
    );

    expect(screen.getByText("Aucune action pour ce dossier")).toBeInTheDocument();
  });

  it("une seule action restante → singulier", () => {
    render(
      <ul>
        <CaseFileTile caseFile={makeCase({ actionsTotal: 1, actionsRemaining: 1 })} />
      </ul>,
    );

    expect(screen.getByText("1 action restante")).toBeInTheDocument();
  });
});
