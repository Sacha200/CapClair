import { RiCheckLine } from "@remixicon/react";
import type { ResultAction } from "@capclair/contract";
import { formatFrenchDate } from "@/lib/cases/result-format";
import { ResultCard } from "./result-card";
import { SourceExcerptDisclosure } from "./source-excerpt-disclosure";

/**
 * US-4.1 (actions à faire) — **lecture seule en E4**. Les cases sont
 * décoratives (`aria-hidden`) : le cochage est US-5.2 (E5). Chaque action
 * expose son extrait source (US-4.2).
 */
export function ActionsList({ actions }: { actions: ResultAction[] }) {
  const title = `Actions à faire (${actions.length})`;

  return (
    <ResultCard title={title} titleId="actions-title">
      {actions.length === 0 ? (
        <p className="text-sm text-text-muted">Aucune action n&apos;a été identifiée.</p>
      ) : (
        <ul className="space-y-2">
          {actions.map((action) => {
            const due = formatFrenchDate(action.dueDate);
            return (
              <li
                key={action.id}
                className="rounded-[var(--radius-card-inner)] bg-bg-subtle px-3 py-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-border-strong bg-bg-surface"
                  >
                    {action.done ? (
                      <RiCheckLine size={14} className="text-primary" />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text">{action.title}</p>
                    {due ? (
                      <p className="mt-0.5 text-xs text-text-muted">Pour le {due}</p>
                    ) : null}
                    <SourceExcerptDisclosure
                      excerpt={action.sourceExcerpt}
                      verifiable={action.verifiable}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ResultCard>
  );
}
