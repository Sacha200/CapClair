import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeAction } from "@/components/cases/result.fixture";
import { ApiError } from "@/lib/api/errors";

const refresh = vi.fn();
const toggleAction = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api/cases", () => ({
  toggleAction: (...args: unknown[]) => toggleAction(...args),
  createAction: vi.fn(),
  deleteAction: vi.fn(),
}));

import { PilotageActionsList } from "./pilotage-actions-list";

const CASE_ID = "11111111-1111-4111-8111-111111111111";

describe("PilotageActionsList (US-5.2)", () => {
  beforeEach(() => {
    refresh.mockReset();
    toggleAction.mockReset();
  });

  it("clic sur une case coche immédiatement (optimiste), avant la réponse réseau", () => {
    let resolvePromise!: () => void;
    toggleAction.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = () => resolve({ ok: true });
      }),
    );
    const action = makeAction({ id: "a1", title: "Envoyer le RIB", done: false });
    render(<PilotageActionsList caseFileId={CASE_ID} actions={[action]} />);

    const checkbox = screen.getByRole("checkbox", { name: "Envoyer le RIB" });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    // Assertion juste après le clic, AVANT toute résolution de la promesse mockée.
    expect(checkbox).toBeChecked();
    expect(toggleAction).toHaveBeenCalledWith(CASE_ID, "a1", { done: true });
    expect(refresh).not.toHaveBeenCalled();

    resolvePromise();
  });

  it("compteur de progression arrondi entier (1 sur 3 → 33 %)", () => {
    const actions = [
      makeAction({ id: "a1", title: "Action 1", done: true }),
      makeAction({ id: "a2", title: "Action 2", done: false }),
      makeAction({ id: "a3", title: "Action 3", done: false }),
    ];
    toggleAction.mockResolvedValue({ ok: true });
    render(<PilotageActionsList caseFileId={CASE_ID} actions={actions} />);
    expect(screen.getByText("1/3 terminées (33 %)")).toBeInTheDocument();
  });

  it("action sans sourceExcerpt (MANUEL) : aucun SourceExcerptDisclosure rendu", () => {
    const action = makeAction({
      id: "a1",
      title: "Ajoutée à la main",
      origin: "MANUEL",
      sourceExcerpt: null,
      verifiable: null,
    });
    render(<PilotageActionsList caseFileId={CASE_ID} actions={[action]} />);
    expect(screen.queryByText(/voir l'extrait/i)).not.toBeInTheDocument();
  });

  it("action avec sourceExcerpt non-null : SourceExcerptDisclosure rendu", () => {
    const action = makeAction({
      id: "a1",
      title: "Envoyer le justificatif",
      sourceExcerpt: "merci de nous transmettre un justificatif",
      verifiable: true,
    });
    render(<PilotageActionsList caseFileId={CASE_ID} actions={[action]} />);
    expect(screen.getByText(/voir l'extrait/i)).toBeInTheDocument();
  });

  it("action cochée (done=true) → titre barré et atténué (revue fidélité Figma)", () => {
    const action = makeAction({ id: "a1", title: "Envoyer le RIB", done: true });
    render(<PilotageActionsList caseFileId={CASE_ID} actions={[action]} />);

    expect(screen.getByText("Envoyer le RIB")).toHaveClass("line-through", "text-text-muted");
  });

  it("action non cochée (done=false) → titre sans décoration", () => {
    const action = makeAction({ id: "a1", title: "Envoyer le RIB", done: false });
    render(<PilotageActionsList caseFileId={CASE_ID} actions={[action]} />);

    expect(screen.getByText("Envoyer le RIB")).not.toHaveClass("line-through");
  });

  it("échec PATCH (ex. 429) au cochage → message d'erreur visible, case repliée", async () => {
    toggleAction.mockRejectedValue(
      new ApiError(429, { error: "Trop de tentatives. Réessayez dans 1 minute." }),
    );
    const action = makeAction({ id: "a1", title: "Envoyer le RIB", done: false });
    render(<PilotageActionsList caseFileId={CASE_ID} actions={[action]} />);

    const checkbox = screen.getByRole("checkbox", { name: "Envoyer le RIB" });
    fireEvent.click(checkbox);

    expect(
      await screen.findByText("Trop de tentatives. Réessayez dans 1 minute."),
    ).toBeInTheDocument();
    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(refresh).not.toHaveBeenCalled();
  });
});
