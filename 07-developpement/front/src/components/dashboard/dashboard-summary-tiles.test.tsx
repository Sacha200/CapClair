import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DashboardSummary } from "@capclair/contract";
import { DashboardSummaryTiles } from "./dashboard-summary-tiles";

const BASE_SUMMARY: DashboardSummary = {
  activeCount: 3,
  deadlineWithin7DaysCount: 1,
  remainingActionsCount: 5,
  recentAnalyses: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Demande de justificatifs",
      organisme: "CAF",
      analysisStatus: "TERMINEE",
      analyzedAt: "2026-09-10T10:00:00.000Z",
    },
  ],
  recentNotifications: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      type: "ANALYSE_TERMINEE",
      title: "Analyse terminée",
      body: "Votre dossier a été analysé.",
      read: false,
      createdAt: "2026-09-11T10:00:00.000Z",
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      type: "ANALYSE_ECHEC",
      title: "Analyse échouée",
      body: "L'analyse de votre courrier n'a pas abouti. Vous pouvez la relancer.",
      read: true,
      createdAt: "2026-09-09T10:00:00.000Z",
    },
  ],
};

describe("DashboardSummaryTiles (US-5.4 AC1)", () => {
  it("affiche chaque compteur avec son label textuel", () => {
    render(<DashboardSummaryTiles summary={BASE_SUMMARY} />);

    expect(screen.getByText("Dossiers actifs")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Échéances sous 7 jours")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Actions restantes")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("rend les 5 dernières analyses (titre + organisme + statut)", () => {
    render(<DashboardSummaryTiles summary={BASE_SUMMARY} />);

    expect(screen.getByText("Demande de justificatifs")).toBeInTheDocument();
    expect(screen.getByText(/CAF/)).toBeInTheDocument();
    expect(screen.getByText(/Terminée/)).toBeInTheDocument();
  });

  it("rend les notifications récentes (titre + corps) et distingue lue / non lue", () => {
    render(<DashboardSummaryTiles summary={BASE_SUMMARY} />);

    expect(screen.getByText("Analyse terminée")).toBeInTheDocument();
    expect(screen.getByText("Analyse échouée")).toBeInTheDocument();
    expect(
      screen.getByText("L'analyse de votre courrier n'a pas abouti. Vous pouvez la relancer."),
    ).toBeInTheDocument();
    // La notification non lue porte un indicateur textuel, pas seulement visuel.
    expect(screen.getByText("(non lue)")).toBeInTheDocument();
  });

  it("état vide : aucune analyse / notification → messages de repli", () => {
    render(
      <DashboardSummaryTiles
        summary={{ ...BASE_SUMMARY, recentAnalyses: [], recentNotifications: [] }}
      />,
    );

    expect(screen.getByText(/aucune analyse terminée/i)).toBeInTheDocument();
    expect(screen.getByText(/aucune notification/i)).toBeInTheDocument();
  });
});
