import { RiInformationLine } from "@remixicon/react";

/**
 * `CaseFile.warnings` (E3) — points d'attention propres au courrier, rendus
 * sobrement sous le résumé. Distinct du bandeau permanent US-4.1 AC3
 * (`ResultWarningBanner`). Rien n'est affiché si la liste est vide.
 *
 * Risque connu (plan E4 §8.2) : ce champ IA s'est montré parfois verbeux sur
 * le corpus E3 — rendu volontairement neutre, sans langage alarmiste.
 */
export function WarningsNote({ warnings }: { warnings: string[] }) {
  const items = warnings.map((w) => w.trim()).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-card-inner)] border border-border bg-bg-subtle px-4 py-3 text-sm text-text">
      <p className="flex items-center gap-1.5 font-semibold text-text-strong">
        <RiInformationLine size={16} className="shrink-0 text-text-muted" aria-hidden />
        À noter
      </p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
