import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { makeRequiredDoc } from "@/components/cases/result.fixture";
import { ApiError } from "@/lib/api/errors";

const refresh = vi.fn();
const updateRequiredDoc = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api/cases", () => ({
  updateRequiredDoc: (...args: unknown[]) => updateRequiredDoc(...args),
}));

import { PilotageRequiredDocsList } from "./pilotage-required-docs-list";

const CASE_ID = "11111111-1111-4111-8111-111111111111";

describe("PilotageRequiredDocsList (US-5.3)", () => {
  beforeEach(() => {
    refresh.mockReset();
    updateRequiredDoc.mockReset();
  });

  it("clic sur la case coche immédiatement (optimiste), avant la réponse réseau", () => {
    let resolvePromise!: () => void;
    updateRequiredDoc.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = () => resolve({ ok: true });
      }),
    );
    const doc = makeRequiredDoc({ id: "d1", name: "RIB", provided: false });
    render(<PilotageRequiredDocsList caseFileId={CASE_ID} requiredDocuments={[doc]} />);

    const checkbox = screen.getByRole("checkbox", { name: "RIB" });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    // Assertion juste après le clic, AVANT toute résolution de la promesse mockée.
    expect(checkbox).toBeChecked();
    expect(updateRequiredDoc).toHaveBeenCalledWith(CASE_ID, "d1", { provided: true });
    expect(refresh).not.toHaveBeenCalled();

    resolvePromise();
  });

  it("note saisie puis soumise → updateRequiredDoc appelé avec la bonne valeur", async () => {
    updateRequiredDoc.mockResolvedValue({ ok: true });
    const doc = makeRequiredDoc({ id: "d1", name: "RIB" });
    render(<PilotageRequiredDocsList caseFileId={CASE_ID} requiredDocuments={[doc]} />);

    const noteField = screen.getByLabelText("Note");
    fireEvent.change(noteField, { target: { value: "Demandé un duplicata à la banque" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(updateRequiredDoc).toHaveBeenCalledWith(CASE_ID, "d1", {
      userNote: "Demandé un duplicata à la banque",
    });
  });

  it("échec réseau à la sauvegarde de la note → repli sur la note d'origine, message d'erreur visible", async () => {
    updateRequiredDoc.mockRejectedValue(new Error("network error"));
    const doc = makeRequiredDoc({ id: "d1", name: "RIB", userNote: "Note initiale" });
    render(<PilotageRequiredDocsList caseFileId={CASE_ID} requiredDocuments={[doc]} />);

    const noteField = screen.getByLabelText("Note") as HTMLInputElement;
    fireEvent.change(noteField, { target: { value: "Note modifiée" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(updateRequiredDoc).toHaveBeenCalledWith(CASE_ID, "d1", { userNote: "Note modifiée" });
    // `save()` catche l'échec (comme `toggle()`) : repli sur la valeur d'origine,
    // pas de propagation en rejet non attrapé, mais un message d'erreur visible.
    await waitFor(() => expect(noteField.value).toBe("Note initiale"));
    expect(
      await screen.findByText("La modification n'a pas abouti. Réessayez."),
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("échec PATCH (ex. 429) au cochage → message d'erreur visible, case repliée", async () => {
    updateRequiredDoc.mockRejectedValue(
      new ApiError(429, { error: "Trop de tentatives. Réessayez dans 1 minute." }),
    );
    const doc = makeRequiredDoc({ id: "d1", name: "RIB", provided: false });
    render(<PilotageRequiredDocsList caseFileId={CASE_ID} requiredDocuments={[doc]} />);

    const checkbox = screen.getByRole("checkbox", { name: "RIB" });
    fireEvent.click(checkbox);

    expect(
      await screen.findByText("Trop de tentatives. Réessayez dans 1 minute."),
    ).toBeInTheDocument();
    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(refresh).not.toHaveBeenCalled();
  });

  it("compteur « X sur Y justificatifs prêts » correct sur un jeu de données mixte", () => {
    const docs = [
      makeRequiredDoc({ id: "d1", name: "Doc 1", provided: true }),
      makeRequiredDoc({ id: "d2", name: "Doc 2", provided: false }),
      makeRequiredDoc({ id: "d3", name: "Doc 3", provided: true }),
    ];
    render(<PilotageRequiredDocsList caseFileId={CASE_ID} requiredDocuments={docs} />);
    expect(screen.getByText("2 sur 3 justificatifs prêts")).toBeInTheDocument();
  });
});
