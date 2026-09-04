import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfidenceRecapBanner } from "./confidence-recap-banner";

describe("ConfidenceRecapBanner (US-4.3 AC3)", () => {
  it("liste vide → rien affiché", () => {
    const { container } = render(<ConfidenceRecapBanner infos={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("infos à vérifier → libellés listés avec ancre #info-<id>", () => {
    render(
      <ConfidenceRecapBanner
        infos={[
          { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", label: "Montant de l'indu" },
          { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", label: "Date limite" },
        ]}
      />,
    );
    expect(screen.getByText("2 informations à vérifier")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Montant de l'indu" });
    expect(link).toHaveAttribute("href", "#info-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("une seule info → libellé au singulier", () => {
    render(
      <ConfidenceRecapBanner
        infos={[{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", label: "Référence" }]}
      />,
    );
    expect(screen.getByText("1 information à vérifier")).toBeInTheDocument();
  });
});
