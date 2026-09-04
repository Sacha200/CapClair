import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfidenceBadge } from "./confidence-badge";

describe("ConfidenceBadge (US-4.3 AC2 / D10)", () => {
  it("FAIBLE → libellé texte « À vérifier » présent dans le DOM", () => {
    render(<ConfidenceBadge level="FAIBLE" />);
    // Le signal passe par un nœud texte, pas seulement par la couleur.
    expect(screen.getByText("À vérifier")).toBeInTheDocument();
  });

  it("FAIBLE avec lowLabel → libellé surchargé", () => {
    render(<ConfidenceBadge level="FAIBLE" lowLabel="Date à vérifier" />);
    expect(screen.getByText("Date à vérifier")).toBeInTheDocument();
  });

  it("MOYEN → signal texte explicite « Confiance moyenne »", () => {
    render(<ConfidenceBadge level="MOYEN" />);
    expect(screen.getByText("Confiance moyenne")).toBeInTheDocument();
  });

  it("ELEVE → rien affiché", () => {
    const { container } = render(<ConfidenceBadge level="ELEVE" />);
    expect(container).toBeEmptyDOMElement();
  });
});
