import { DashboardHeader } from "./dashboard-header";

/**
 * US-5.4 AC3 — état vide du tableau de bord (compte sans dossier). Compose
 * `DashboardHeader` (même h1 + bouton "Importer un courrier" que l'écran non
 * vide, pas de markup dupliqué) et ajoute le texte d'état vide.
 */
export function EmptyDashboard() {
  return (
    <section>
      <DashboardHeader />
      <p className="mt-4 text-sm text-text-muted">
        Vous n&apos;avez pas encore de dossier. Importez un courrier pour commencer.
      </p>
    </section>
  );
}
