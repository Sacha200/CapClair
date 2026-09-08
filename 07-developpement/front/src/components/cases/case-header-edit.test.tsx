import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const updateCaseScalars = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api/cases", () => ({
  updateCaseScalars: (...args: unknown[]) => updateCaseScalars(...args),
}));

import { CaseHeaderEdit } from "./case-header-edit";

const CASE_ID = "11111111-1111-4111-8111-111111111111";

function open() {
  render(
    <CaseHeaderEdit
      caseFileId={CASE_ID}
      organisme="CAF"
      title="Demande de justificatifs"
      documentDate="2026-07-03T00:00:00.000Z"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /corriger l'en-tête/i }));
}

describe("CaseHeaderEdit (US-4.4 AC1)", () => {
  beforeEach(() => {
    refresh.mockReset();
    updateCaseScalars.mockReset().mockResolvedValue({ ok: true });
  });

  it("n'envoie que le champ modifié (organisme)", async () => {
    open();
    fireEvent.change(screen.getByLabelText("Organisme"), { target: { value: "CPAM" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(updateCaseScalars).toHaveBeenCalledWith(CASE_ID, { organisme: "CPAM" }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("aucun changement → referme sans appel API", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(updateCaseScalars).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Organisme")).not.toBeInTheDocument();
  });

  it("modifie le titre et la date ensemble", async () => {
    open();
    fireEvent.change(screen.getByLabelText("Type de courrier"), {
      target: { value: "Notification de trop-perçu" },
    });
    fireEvent.change(screen.getByLabelText("Date du courrier"), {
      target: { value: "2026-07-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(updateCaseScalars).toHaveBeenCalledWith(CASE_ID, {
        title: "Notification de trop-perçu",
        documentDate: "2026-07-10",
      }),
    );
  });
});
