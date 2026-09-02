import Link from "next/link";
import { RiAddLine } from "@remixicon/react";

export default function DashboardPage() {
  return (
    <section>
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
      <p className="mt-4 text-sm text-text-muted">
        Vous n&apos;avez pas encore de dossier. Importez un courrier pour commencer — la liste des
        dossiers arrivera avec le tableau de bord (epic E5, US-5.4).
      </p>
    </section>
  );
}
