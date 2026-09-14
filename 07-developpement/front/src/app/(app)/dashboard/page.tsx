import type { Metadata } from "next";
import { listCases } from "@/lib/api/cases";
import { readCookieHeader } from "@/lib/session";
import { CaseFileList } from "@/components/dashboard/case-file-list";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSummaryTiles } from "@/components/dashboard/dashboard-summary-tiles";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";

export const metadata: Metadata = { title: "Tableau de bord — CapClair" };

/**
 * Tableau de bord (US-5.4) : liste des dossiers du compte + résumé de
 * pilotage. État vide (AC3) si le compte n'a encore aucun dossier — le bouton
 * d'import reste visible dans les deux cas (AC2).
 */
export default async function DashboardPage() {
  const cookieHeader = await readCookieHeader();
  const { cases, summary } = await listCases(cookieHeader);

  if (cases.length === 0) {
    return <EmptyDashboard />;
  }

  return (
    <section>
      <DashboardHeader />
      <DashboardSummaryTiles summary={summary} />
      <CaseFileList cases={cases} />
    </section>
  );
}
