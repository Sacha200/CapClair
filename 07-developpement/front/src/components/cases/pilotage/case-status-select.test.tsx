import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const refresh = vi.fn();
const updateCaseStatus = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api/cases", () => ({
  updateCaseStatus: (...args: unknown[]) => updateCaseStatus(...args),
}));

import { CaseStatusSelect } from "./case-status-select";

const CASE_ID = "11111111-1111-4111-8111-111111111111";

describe("CaseStatusSelect (US-5.1 AC2)", () => {
  beforeEach(() => {
    refresh.mockReset();
    updateCaseStatus.mockReset().mockResolvedValue({ ok: true });
  });

  it("les 6 options sont présentes avec les bons libellés FR", () => {
    render(<CaseStatusSelect caseFileId={CASE_ID} status="A_ANALYSER" />);
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual([
      "À analyser",
      "Action requise",
      "Documents à préparer",
      "Réponse prête",
      "En attente",
      "Terminé",
    ]);
  });

  it("sélection → updateCaseStatus appelé avec la bonne valeur, puis refresh", async () => {
    render(<CaseStatusSelect caseFileId={CASE_ID} status="A_ANALYSER" />);
    fireEvent.change(screen.getByLabelText("Statut du dossier"), {
      target: { value: "TERMINE" },
    });

    await waitFor(() =>
      expect(updateCaseStatus).toHaveBeenCalledWith(CASE_ID, { status: "TERMINE" }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("erreur API → message affiché, pas de refresh", async () => {
    updateCaseStatus.mockRejectedValue(new ApiError(400, { error: "Requête invalide." }));
    render(<CaseStatusSelect caseFileId={CASE_ID} status="A_ANALYSER" />);
    fireEvent.change(screen.getByLabelText("Statut du dossier"), {
      target: { value: "TERMINE" },
    });

    expect(await screen.findByText("Requête invalide.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
