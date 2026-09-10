import { cn } from "@/lib/cn";

/**
 * Carte titrée de l'écran 05 (maquette Hi-Fi « 05 — Résultat d'analyse »,
 * node 26:146). Padding `px-20 py-18`, rayon 12, titre Mulish Bold 16.
 * `tone="highlight"` pour la carte échéance (fond `warning-light`).
 * `titleVariant="overline"` : petit label 13 muted (carte échéance, node 27:146)
 * au lieu du gros titre de section.
 */
export function ResultCard({
  title,
  titleId,
  titleVariant = "heading",
  caption,
  action,
  tone = "default",
  className,
  children,
}: {
  title: string;
  titleId?: string;
  titleVariant?: "heading" | "overline";
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
        "rounded-[var(--radius-card)] border px-5 py-[18px]",
        tone === "highlight"
          ? "border-warning bg-warning-light"
          : "border-border bg-bg-surface",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id={titleId}
            className={
              titleVariant === "overline"
                ? "text-[13px] font-semibold text-text-muted"
                : "text-base font-bold text-text-strong"
            }
          >
            {title}
          </h2>
          {caption ? <p className="mt-1.5 text-xs text-text-muted">{caption}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
