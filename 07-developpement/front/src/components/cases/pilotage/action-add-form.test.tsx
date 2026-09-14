import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const refresh = vi.fn();
const createAction = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api/cases", () => ({
  createAction: (...args: unknown[]) => createAction(...args),
}));

import { ActionAddForm } from "./action-add-form";

const CASE_ID = "11111111-1111-4111-8111-111111111111";

describe("ActionAddForm (US-5.2 AC2)", () => {
  beforeEach(() => {
    refresh.mockReset();
    createAction.mockReset().mockResolvedValue({ id: "new-id" });
  });

  it("replié par défaut : bouton « Ajouter une action », pas de champ", () => {
    render(<ActionAddForm caseFileId={CASE_ID} />);
    expect(screen.getByRole("button", { name: "Ajouter une action" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("titre seul → createAction appelé sans description ni dueDate dans le corps", async () => {
    render(<ActionAddForm caseFileId={CASE_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une action" }));
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Appeler la CAF" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    await waitFor(() =>
      expect(createAction).toHaveBeenCalledWith(CASE_ID, { title: "Appeler la CAF" }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("les trois champs remplis → les trois dans le corps", async () => {
    render(<ActionAddForm caseFileId={CASE_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une action" }));
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Envoyer le RIB" } });
    fireEvent.change(screen.getByLabelText("Description (facultatif)"), {
      target: { value: "Au nom du demandeur." },
    });
    fireEvent.change(screen.getByLabelText("Échéance (facultatif)"), {
      target: { value: "2026-09-30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    await waitFor(() =>
      expect(createAction).toHaveBeenCalledWith(CASE_ID, {
        title: "Envoyer le RIB",
        description: "Au nom du demandeur.",
        dueDate: "2026-09-30",
      }),
    );
  });

  it("titre vide → erreur affichée, aucun appel API", async () => {
    render(<ActionAddForm caseFileId={CASE_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une action" }));
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    expect(await screen.findByText(/le titre est obligatoire/i)).toBeInTheDocument();
    expect(createAction).not.toHaveBeenCalled();
  });

  it("erreur API → message du serveur affiché, pas de refresh", async () => {
    createAction.mockRejectedValue(new ApiError(400, { error: "Requête invalide." }));
    render(<ActionAddForm caseFileId={CASE_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une action" }));
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Une action" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    expect(await screen.findByText("Requête invalide.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
