import { RiCheckLine } from "@remixicon/react";
import type { ResultRequiredDoc } from "@capclair/contract";
import { ResultCard } from "./result-card";
import { SourceExcerptDisclosure } from "./source-excerpt-disclosure";

/**
 * US-4.1 (justificatifs à préparer) — lecture seule en E4, mêmes règles que
 * `ActionsList` (cases décoratives, extrait source par ligne).
 */
export function RequiredDocsList({ docs }: { docs: ResultRequiredDoc[] }) {
  const title = `Justificatifs à préparer (${docs.length})`;

  return (
    <ResultCard
      title={title}
      titleId="required-docs-title"
      caption="Les documents à joindre à votre réponse."
    >
      {docs.length === 0 ? (
        <p className="text-sm text-text-muted">Aucun justificatif n&apos;est demandé.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="rounded-[var(--radius-chip)] bg-bg-subtle px-3 py-2.5"
            >
              <div className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-[1.5px] border-border-strong bg-bg-surface"
                >
                  {doc.provided ? (
                    <RiCheckLine size={14} className="text-primary" />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{doc.name}</p>
                  <SourceExcerptDisclosure
                    excerpt={doc.sourceExcerpt}
                    verifiable={doc.verifiable}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ResultCard>
  );
}
