import { RiAlertLine } from "@remixicon/react";

/**
 * US-4.2 — « Voir l'extrait source ». `<details>` natif (clavier + lecteurs
 * d'écran sans JS). Fermé par défaut.
 *
 * - `verifiable` : l'extrait est un passage littéral du courrier → on l'affiche.
 * - `!verifiable` : le passage n'a pas été retrouvé tel quel dans le document →
 *   on n'affiche AUCUN extrait, seulement l'avertissement (US-4.2 AC3).
 */
export function SourceExcerptDisclosure({
  excerpt,
  verifiable,
  inline = false,
}: {
  excerpt: string;
  verifiable: boolean;
  /** Placé dans une ligne flex (puce « Informations extraites », node 28:149) :
   *  déclencheur aligné à droite fermé, contenu pleine largeur une fois ouvert. */
  inline?: boolean;
}) {
  return (
    <details
      className={
        inline
          ? "group shrink-0 text-sm open:mt-1.5 open:basis-full"
          : "group mt-1.5 text-sm"
      }
    >
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-xs font-semibold text-primary hover:underline [&::-webkit-details-marker]:hidden">
        Voir l&apos;extrait source
      </summary>
      {verifiable ? (
        <blockquote className="mt-1.5 border-l-2 border-border-strong bg-bg-subtle px-3 py-2 font-[family-name:var(--font-reading)] text-sm text-text">
          {excerpt}
        </blockquote>
      ) : (
        <p className="mt-1.5 inline-flex items-start gap-1.5 text-xs text-warning">
          <RiAlertLine size={14} className="mt-0.5 shrink-0" aria-hidden />
          Extrait non retrouvé tel quel dans le document — information à vérifier.
        </p>
      )}
    </details>
  );
}
