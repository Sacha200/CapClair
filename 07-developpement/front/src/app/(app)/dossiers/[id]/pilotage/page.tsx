import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CaseFileResultResponse } from "@capclair/contract";
import { AnalysisWaiting } from "@/components/cases/analysis-waiting";
import { CasePilotage } from "@/components/cases/pilotage/case-pilotage";
import { getCaseResult } from "@/lib/api/cases";
import { ApiError } from "@/lib/api/errors";
import { readCookieHeader } from "@/lib/session";

export const metadata: Metadata = { title: "Pilotage du dossier — CapClair" };

/**
 * Écran 06 (amorce, E5) — pilotage du dossier : statut + actions. Même gabarit
 * que l'écran 05 (`dossiers/[id]/page.tsx`) : le résultat riche n'est
 * disponible que si l'analyse est `TERMINEE` (`200`) ; `409`
 * `analysis_not_ready` / réseau / `5xx` retombent sur l'écran d'attente ; `404`
 * (dossier inexistant / autre compte) est définitif. Garde de session héritée
 * de `(app)/layout.tsx`.
 */
export default async function PilotagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = await readCookieHeader();

  let result: CaseFileResultResponse | null = null;
  try {
    result = await getCaseResult(id, cookieHeader);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
  }

  if (result) {
    return <CasePilotage data={result} caseFileId={id} />;
  }

  return (
    <section>
      <h1 className="sr-only">Pilotage du dossier</h1>
      <AnalysisWaiting caseFileId={id} />
    </section>
  );
}
