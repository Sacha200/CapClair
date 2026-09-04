import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RESULT_WARNING_BANNER } from "@capclair/contract";
import { AnalysisResult } from "./analysis-result";
import { makeAction, makeInfo, makeRequiredDoc, makeResult } from "./result.fixture";

describe("AnalysisResult — écran 05", () => {
  it("rend les 6 sections US-4.1 dans l'ordre imposé (DOM)", () => {
    render(
      <AnalysisResult
        data={makeResult({
          actions: [makeAction()],
          requiredDocuments: [makeRequiredDoc()],
          informations: [makeInfo()],
        })}
      />,
    );

    const order = [
      "Échéance principale",
      "Résumé",
      "Actions à faire (1)",
      "Justificatifs à préparer (1)",
      "Informations extraites",
      "Brouillon de réponse",
    ];
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent?.trim());
    // Sous-suite : d'autres h2 (bandeau récap) peuvent s'intercaler, mais
    // l'ordre relatif des 6 sections doit être respecté.
    const positions = order.map((label) => headings.indexOf(label));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.every((p) => p >= 0)).toBe(true);
  });

  it("la carte échéance précède le résumé dans le DOM (AC2)", () => {
    render(<AnalysisResult data={makeResult()} />);
    const deadline = screen.getByRole("heading", { name: "Échéance principale" });
    const summary = screen.getByRole("heading", { name: "Résumé" });
    expect(
      deadline.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("affiche le bandeau d'avertissement permanent, texte exact du contrat (AC3)", () => {
    render(<AnalysisResult data={makeResult()} />);
    expect(screen.getByText(RESULT_WARNING_BANNER)).toBeInTheDocument();
  });

  it("titre + sous-titre organisme / date de réception", () => {
    render(<AnalysisResult data={makeResult()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Demande de justificatifs" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/CAF · courrier reçu le 3 juillet 2026/)).toBeInTheDocument();
  });

  it("échéance RELATIVE → mention « Calculée par le serveur à partir de … » (D7)", () => {
    render(<AnalysisResult data={makeResult()} />);
    expect(screen.getByText(/Calculée par le serveur à partir de/)).toBeInTheDocument();
  });

  it("échéance révolue → « Échéance dépassée » (US-3.6 AC4)", () => {
    render(
      <AnalysisResult
        data={makeResult({
          mainDeadline: {
            date: "2020-01-01T00:00:00.000Z",
            type: "EXPLICITE",
            confidence: "ELEVE",
            sourceExcerpt: null,
            computedFromDelay: false,
            overdue: true,
            isUserCorrected: false,
          },
        })}
      />,
    );
    expect(screen.getByText("Échéance dépassée.")).toBeInTheDocument();
  });

  it("bandeau récap rendu quand infosToVerify n'est pas vide", () => {
    render(
      <AnalysisResult
        data={makeResult({
          informations: [makeInfo({ confidenceLevel: "FAIBLE", verifiable: false })],
          infosToVerify: [{ id: makeInfo().id, label: "Référence allocataire" }],
        })}
      />,
    );
    const recap = screen.getByRole("heading", { name: /information à vérifier/i });
    expect(within(recap.closest("section")!).getByRole("link", { name: "Référence allocataire" })).toHaveAttribute(
      "href",
      `#info-${makeInfo().id}`,
    );
  });
});
