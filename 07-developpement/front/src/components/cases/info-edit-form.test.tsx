import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { makeInfo } from "./result.fixture";

const refresh = vi.fn();
const updateExtractedInfo = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api/cases", () => ({
  updateExtractedInfo: (...args: unknown[]) => updateExtractedInfo(...args),
}));

import { InfoEditForm } from "./info-edit-form";

const CASE_ID = "11111111-1111-4111-8111-111111111111";

describe("InfoEditForm (US-4.4)", () => {
  beforeEach(() => {
    refresh.mockReset();
    updateExtractedInfo.mockReset().mockResolvedValue({ ok: true });
  });

  it("replié par défaut : bouton « Corriger », pas de champ", () => {
    render(<InfoEditForm caseFileId={CASE_ID} info={makeInfo()} />);
    expect(screen.getByRole("button", { name: /corriger cette information/i })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("ouvre le champ pré-rempli, envoie la valeur corrigée puis rafraîchit", async () => {
    const info = makeInfo({ value: "0847213C" });
    render(<InfoEditForm caseFileId={CASE_ID} info={info} />);
    fireEvent.click(screen.getByRole("button", { name: /corriger cette information/i }));

    const field = screen.getByRole("textbox") as HTMLInputElement;
    expect(field.value).toBe("0847213C");
    fireEvent.change(field, { target: { value: "0847213Z" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(updateExtractedInfo).toHaveBeenCalledWith(CASE_ID, info.id, { value: "0847213Z" }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("valeur vide → erreur affichée, aucun appel API", async () => {
    render(<InfoEditForm caseFileId={CASE_ID} info={makeInfo()} />);
    fireEvent.click(screen.getByRole("button", { name: /corriger cette information/i }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText(/ne peut pas être vide/i)).toBeInTheDocument();
    expect(updateExtractedInfo).not.toHaveBeenCalled();
  });

  it("erreur API → message du serveur affiché, pas de refresh", async () => {
    updateExtractedInfo.mockRejectedValue(new ApiError(400, { error: "Requête invalide." }));
    render(<InfoEditForm caseFileId={CASE_ID} info={makeInfo()} />);
    fireEvent.click(screen.getByRole("button", { name: /corriger cette information/i }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("Requête invalide.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("Échap referme sans enregistrer", () => {
    render(<InfoEditForm caseFileId={CASE_ID} info={makeInfo()} />);
    fireEvent.click(screen.getByRole("button", { name: /corriger cette information/i }));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(updateExtractedInfo).not.toHaveBeenCalled();
  });
});
