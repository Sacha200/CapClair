import { cn } from "@/lib/cn";

/**
 * Carte titrée de l'écran 05 (maquette Hi-Fi « 05 — Résultat d'analyse »,
 * node 26:146). Titre = Heading/H3. `tone="highlight"` pour la carte échéance
 * (fond `warning-light`).
 */
export function ResultCard({
  title,
  titleId,
  caption,
  action,
  tone = "default",
  className,
  children,
}: {
  title: string;
  titleId?: string;
  caption?: string;
  action?: React.ReactNode;
  tone?: "default" | "highlight";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "rounded-[var(--radius-card)] border p-5",
        tone === "highlight"
          ? "border-warning bg-warning-light"
          : "border-border bg-bg-surface",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={titleId} className="text-base font-semibold text-text-strong">
            {title}
          </h2>
          {caption ? <p className="mt-1 text-xs text-text-muted">{caption}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
