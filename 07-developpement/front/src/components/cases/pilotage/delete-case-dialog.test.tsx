import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const deleteCase = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/api/cases", () => ({
  deleteCase: (...args: unknown[]) => deleteCase(...args),
}));

import { DeleteCaseDialog } from "./delete-case-dialog";

const CASE_ID = "11111111-1111-4111-8111-111111111111";

describe("DeleteCaseDialog (US-5.5)", () => {
  beforeEach(() => {
    push.mockReset();
    deleteCase.mockReset().mockResolvedValue({ ok: true });
  });

  it("état par défaut : bouton « Supprimer ce dossier » visible, aucun panneau, aucun appel API", () => {
    render(<DeleteCaseDialog caseFileId={CASE_ID} />);

    expect(screen.getByRole("button", { name: "Supprimer ce dossier" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(deleteCase).not.toHaveBeenCalled();
  });

  it("premier clic affiche le panneau de confirmation avec le texte d'irréversibilité, aucun appel API", () => {
    render(<DeleteCaseDialog caseFileId={CASE_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer ce dossier" }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("définitive");
    expect(alert).toHaveTextContent("irréversible");
    expect(
      screen.getByRole("button", { name: "Confirmer la suppression" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annuler" })).toBeInTheDocument();
    expect(deleteCase).not.toHaveBeenCalled();
  });

  it("clic « Confirmer la suppression » → deleteCase appelé, puis redirection vers /dashboard", async () => {
    render(<DeleteCaseDialog caseFileId={CASE_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer ce dossier" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la suppression" }));

    await waitFor(() => expect(deleteCase).toHaveBeenCalledWith(CASE_ID));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
  });

  it("clic « Annuler » → aucun appel API, retour à l'état par défaut", () => {
    render(<DeleteCaseDialog caseFileId={CASE_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer ce dossier" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Supprimer ce dossier" })).toBeInTheDocument();
    expect(deleteCase).not.toHaveBeenCalled();
  });
});
