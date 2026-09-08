import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const refresh = vi.fn();
const updateMainDeadline = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api/cases", () => ({
  updateMainDeadline: (...args: unknown[]) => updateMainDeadline(...args),
}));

import { DeadlineEditDialog } from "./deadline-edit-dialog";

const CASE_ID = "11111111-1111-4111-8111-111111111111";

describe("DeadlineEditDialog (US-4.4 AC5)", () => {
  beforeEach(() => {
    refresh.mockReset();
    updateMainDeadline.mockReset().mockResolvedValue({ ok: true });
  });

  it("replié par défaut : bouton « Corriger l'échéance »", () => {
    render(
      <DeadlineEditDialog
        caseFileId={CASE_ID}
        currentDate="2026-08-02T00:00:00.000Z"
        minDate="2026-07-03"
      />,
    );
    expect(screen.getByRole("button", { name: /corriger l'échéance/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/nouvelle date/i)).not.toBeInTheDocument();
  });

  it("ouvre un champ date borné, envoie la date puis rafraîchit", async () => {
    render(
      <DeadlineEditDialog
        caseFileId={CASE_ID}
        currentDate="2026-08-02T00:00:00.000Z"
        minDate="2026-07-03"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /corriger l'échéance/i }));

    const field = screen.getByLabelText(/nouvelle date/i) as HTMLInputElement;
    expect(field.value).toBe("2026-08-02");
    expect(field.min).toBe("2026-07-03");

    fireEvent.change(field, { target: { value: "2026-08-14" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(updateMainDeadline).toHaveBeenCalledWith(CASE_ID, { date: "2026-08-14" }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("400 deadline_before_document → message du serveur, pas de refresh", async () => {
    updateMainDeadline.mockRejectedValue(
      new ApiError(400, {
        error: "L'échéance ne peut pas précéder la date du courrier.",
        code: "deadline_before_document",
      }),
    );
    const { container } = render(
      <DeadlineEditDialog caseFileId={CASE_ID} currentDate="2026-07-20T00:00:00.000Z" minDate="2026-07-03" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /corriger l'échéance/i }));
    fireEvent.change(screen.getByLabelText(/nouvelle date/i), { target: { value: "2026-07-01" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() =>
      expect(updateMainDeadline).toHaveBeenCalledWith(CASE_ID, { date: "2026-07-01" }),
    );
    expect(
      await screen.findByText(/ne peut pas précéder la date du courrier/i),
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
