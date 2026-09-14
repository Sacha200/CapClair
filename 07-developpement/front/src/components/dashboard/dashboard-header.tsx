import Link from "next/link";
import { RiAddLine } from "@remixicon/react";

/**
 * US-5.4 AC2 — en-tête du tableau de bord : h1 « Mes dossiers » + bouton
 * « Importer un courrier », visible en haut de page sans dépendre du
 * défilement. Même style que l'ancien stub (voir `EmptyDashboard`).
 */
export function DashboardHeader() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-text-strong">Mes dossiers</h1>
      <Link
        href="/importer"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-button)] bg-primary px-4 text-sm font-semibold text-text-on-primary transition-colors hover:bg-primary-hover"
      >
        <RiAddLine size={18} aria-hidden />
        Importer un courrier
      </Link>
    </div>
  );
}
