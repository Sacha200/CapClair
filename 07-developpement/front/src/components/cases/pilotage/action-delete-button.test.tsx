import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const deleteAction = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api/cases", () => ({
  deleteAction: (...args: unknown[]) => deleteAction(...args),
}));

import { ActionDeleteButton } from "./action-delete-button";

const CASE_ID = "11111111-1111-4111-8111-111111111111";
const ACTION_ID = "33333333-3333-4333-8333-333333333333";

describe("ActionDeleteButton (US-5.2 AC3)", () => {
  beforeEach(() => {
    refresh.mockReset();
    deleteAction.mockReset().mockResolvedValue({ ok: true });
  });

  it("premier clic affiche la confirmation, aucun appel API", () => {
    render(<ActionDeleteButton caseFileId={CASE_ID} actionId={ACTION_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer cette action" }));

    expect(screen.getByText("Confirmer ?")).toBeInTheDocument();
    expect(deleteAction).not.toHaveBeenCalled();
  });

  it("clic « Oui » → deleteAction appelé, puis refresh", async () => {
    render(<ActionDeleteButton caseFileId={CASE_ID} actionId={ACTION_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer cette action" }));
    fireEvent.click(screen.getByRole("button", { name: "Oui" }));

    await waitFor(() => expect(deleteAction).toHaveBeenCalledWith(CASE_ID, ACTION_ID));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("clic « Annuler » → aucun appel, la confirmation disparaît", () => {
    render(<ActionDeleteButton caseFileId={CASE_ID} actionId={ACTION_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer cette action" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(screen.queryByText("Confirmer ?")).not.toBeInTheDocument();
    expect(deleteAction).not.toHaveBeenCalled();
  });
});
