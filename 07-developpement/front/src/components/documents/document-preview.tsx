"use client";

import { useState } from "react";
import { documentFileSrc } from "@/lib/api/documents";
import type { DocumentKind } from "@/lib/validation/documents";

/**
 * Aperçu du document importé (US-2.2 AC1) : PDF en iframe (visualiseur natif),
 * image en <img>. Le cookie first-party part automatiquement (même origine via
 * le rewrite /api/back/*). Repli si le navigateur ne rend pas le PDF in-page.
 */
export function DocumentPreview({ id, kind }: { id: string; kind: DocumentKind }) {
  const [failed, setFailed] = useState(false);
  const src = documentFileSrc(id);

  if (failed) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-border bg-bg-subtle p-6 text-center text-sm text-text-muted">
        <p>Aperçu indisponible dans ce navigateur.</p>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-2"
        >
          Ouvrir le document dans un nouvel onglet
        </a>
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <iframe
        src={src}
        title="Aperçu du document"
        onError={() => setFailed(true)}
        className="h-full min-h-[420px] w-full rounded-[var(--radius-card)] border border-border bg-bg-subtle"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- flux authentifié servi par le back, pas un asset optimisable par next/image
    <img
      src={src}
      alt="Aperçu du document importé"
      onError={() => setFailed(true)}
      className="max-h-[520px] w-full rounded-[var(--radius-card)] border border-border object-contain"
    />
  );
}
