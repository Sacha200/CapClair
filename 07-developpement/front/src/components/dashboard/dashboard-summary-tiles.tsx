import type { DashboardSummary } from "@capclair/contract";
import { formatFrenchDate, organismeLabel } from "@/lib/cases/result-format";

type AnalysisStatus = DashboardSummary["recentAnalyses"][number]["analysisStatus"];

const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  ECHEC: "Échec",
};

/**
 * US-5.4 AC1 — compteurs, 5 dernières analyses et notifications récentes du
 * tableau de bord. Chaque compteur porte un label textuel clair (jamais une
 * icône/couleur seule) ; les notifications non lues portent une pastille
 * visuelle distincte en plus du texte (le libellé « non lue » resterait
 * disponible aux lecteurs d'écran via l'attribution du point décoratif).
 */
export function DashboardSummaryTiles({ summary }: { summary: DashboardSummary }) {
  const tiles = [
    { label: "Dossiers actifs", value: summary.activeCount },
    { label: "Échéances sous 7 jours", value: summary.deadlineWithin7DaysCount },
    { label: "Actions restantes", value: summary.remainingActionsCount },
  ];

  return (
    <div className="mt-5 space-y-5">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-[var(--radius-card)] border border-border bg-bg-surface px-4 py-3.5"
          >
            <dt className="text-xs font-medium text-text-muted">{tile.label}</dt>
            <dd className="mt-1 text-2xl font-bold text-text-strong">{tile.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section
          aria-labelledby="recent-analyses-title"
          className="rounded-[var(--radius-card)] border border-border bg-bg-surface px-4 py-3.5"
        >
          <h2 id="recent-analyses-title" className="text-sm font-semibold text-text-strong">
            Dernières analyses
          </h2>
          {summary.recentAnalyses.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">Aucune analyse terminée pour le moment.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {summary.recentAnalyses.map((analysis) => (
                <li key={analysis.id} className="text-sm">
                  <p className="font-medium text-text">{analysis.title}</p>
                  <p className="text-xs text-text-muted">
                    {organismeLabel(analysis.organisme)} ·{" "}
                    {ANALYSIS_STATUS_LABELS[analysis.analysisStatus]}
                    {analysis.analyzedAt ? ` · ${formatFrenchDate(analysis.analyzedAt)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="recent-notifications-title"
          className="rounded-[var(--radius-card)] border border-border bg-bg-surface px-4 py-3.5"
        >
          <h2 id="recent-notifications-title" className="text-sm font-semibold text-text-strong">
            Notifications récentes
          </h2>
          {summary.recentNotifications.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">Aucune notification.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {summary.recentNotifications.map((notification) => (
                <li key={notification.id} className="flex items-start gap-2 text-sm">
                  <span
                    aria-hidden
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${
                      notification.read ? "bg-transparent" : "bg-primary"
                    }`}
                  />
                  <div className="min-w-0">
                    <p
                      className={
                        notification.read
                          ? "font-medium text-text-muted"
                          : "font-semibold text-text-strong"
                      }
                    >
                      {notification.title}
                      {!notification.read ? (
                        <span className="ml-1.5 text-xs font-normal text-primary">(non lue)</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-text-muted">{notification.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
