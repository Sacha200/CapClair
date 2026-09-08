import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { makeResult } from "@/components/cases/result.fixture";

const getCaseResult = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@/lib/api/cases", () => ({ getCaseResult: (...a: unknown[]) => getCaseResult(...a) }));
vi.mock("@/lib/session", () => ({ readCookieHeader: () => Promise.resolve("capclair_session=x") }));
// `useRouter` : requis depuis la PR-C — l'écran 05 rend des formulaires de
// correction (client components) qui l'appellent au rendu.
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  useRouter: () => ({ refresh: vi.fn() }),
}));
// L'écran d'attente est un client component avec polling — on le neutralise.
vi.mock("@/components/cases/analysis-waiting", () => ({
  AnalysisWaiting: () => <div data-testid="waiting" />,
}));

import DossierPage from "./page";

const params = Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" });

describe("DossierPage — bascule attente / résultat", () => {
  beforeEach(() => {
    getCaseResult.mockReset();
    notFound.mockClear();
  });

  it("200 TERMINEE → rend l'écran 05", async () => {
    getCaseResult.mockResolvedValue(makeResult());
    render(await DossierPage({ params }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Demande de justificatifs" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("waiting")).not.toBeInTheDocument();
  });

  it("409 analysis_not_ready → rend l'écran d'attente", async () => {
    getCaseResult.mockRejectedValue(new ApiError(409, { code: "analysis_not_ready" }));
    render(await DossierPage({ params }));
    expect(screen.getByTestId("waiting")).toBeInTheDocument();
  });

  it("404 → notFound()", async () => {
    getCaseResult.mockRejectedValue(new ApiError(404, {}));
    await expect(DossierPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("panne réseau (status 0) → écran d'attente, pas d'erreur", async () => {
    getCaseResult.mockRejectedValue(new ApiError(0, { code: "network" }));
    render(await DossierPage({ params }));
    expect(screen.getByTestId("waiting")).toBeInTheDocument();
  });
});
