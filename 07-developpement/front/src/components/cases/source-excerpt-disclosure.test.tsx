import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceExcerptDisclosure } from "./source-excerpt-disclosure";

describe("SourceExcerptDisclosure (US-4.2)", () => {
  it("fermé par défaut, déclencheur « Voir l'extrait source » visible", () => {
    render(<SourceExcerptDisclosure excerpt="passage littéral du courrier" verifiable />);
    expect(screen.getByText("Voir l'extrait source")).toBeInTheDocument();
    // <details> sans l'attribut `open`.
    expect(screen.getByText("Voir l'extrait source").closest("details")).not.toHaveAttribute(
      "open",
    );
  });

  it("verifiable → l'extrait littéral est rendu", () => {
    render(<SourceExcerptDisclosure excerpt="passage littéral du courrier" verifiable />);
    expect(screen.getByText("passage littéral du courrier")).toBeInTheDocument();
  });

  it("!verifiable → message « non retrouvé », aucun extrait affiché (AC3)", () => {
    render(
      <SourceExcerptDisclosure excerpt="passage inventé par l'IA" verifiable={false} />,
    );
    expect(screen.getByText(/non retrouvé tel quel dans le document/i)).toBeInTheDocument();
    expect(screen.queryByText("passage inventé par l'IA")).not.toBeInTheDocument();
  });
});
