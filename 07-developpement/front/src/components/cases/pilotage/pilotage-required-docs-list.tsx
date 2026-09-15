"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ResultRequiredDoc } from "@capclair/contract";
import { ApiError } from "@/lib/api/errors";
import { updateRequiredDoc } from "@/lib/api/cases";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { SourceExcerptDisclosure } from "@/components/cases/source-excerpt-disclosure";

/**
 * US-5.3 AC1/AC2 — checklist des justificatifs, écran 06. Contrairement à
 * `cases/required-docs-list.tsx` (écran 05, lecture seule, non modifié), la
 * case « fourni » est RÉELLEMENT cochable et chaque ligne porte une note
 * libre. Cochage : mise à jour visuelle immédiate (optimiste) + `PATCH
 * …/justificatifs/:docId` en arrière-plan + `router.refresh()` — même gabarit
 * que `PilotageActionsList` (US-5.2). Un justificatif est TOUJOURS issu de
 * l'analyse (`sourceExcerpt` jamais `null`, contrairement à une action
 * manuelle) : `<SourceExcerptDisclosure>` est donc toujours rendu, sans garde
 * de nullabilité.
 */
export function PilotageRequiredDocsList({
  caseFileId,
  requiredDocuments,
}: {
  caseFileId: string;
  requiredDocuments: ResultRequiredDoc[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(requiredDocuments);
  const [error, setError] = useState<string | null>(null);
  // Même gabarit que `PilotageActionsList` : resynchronise l'état local
  // optimiste quand le server component re-fetch (après un `router.refresh()`
  // déclenché par ce composant ou un autre, ex. changement de statut).
  const [prevDocs, setPrevDocs] = useState(requiredDocuments);
  if (requiredDocuments !== prevDocs) {
    setPrevDocs(requiredDocuments);
    setItems(requiredDocuments);
  }

  const total = items.length;
  const done = items.filter((doc) => doc.provided).length;

  function toggle(doc: ResultRequiredDoc) {
    const nextProvided = !doc.provided;
    setError(null);
    setItems((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, provided: nextProvided } : d)),
    );
    void updateRequiredDoc(caseFileId, doc.id, { provided: nextProvided })
      .then(() => router.refresh())
      .catch((err: unknown) => {
        // Repli sur l'état serveur (la case revient en arrière) + message
        // d'erreur inline : la route est limitée (`RATE_LIMITS.analysis`,
        // 10/minute) et un usage normal de la checklist peut l'atteindre.
        setItems((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, provided: doc.provided } : d)),
        );
        setError(
          err instanceof ApiError ? err.message : "La modification n'a pas abouti. Réessayez.",
        );
      });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-text-strong">
        {done} sur {total} justificatifs prêts
      </p>
      {error ? <p className="text-xs font-medium text-error">{error}</p> : null}

      {items.length === 0 ? (
        <p className="text-sm text-text-muted">Aucun justificatif pour ce dossier.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((doc) => (
            <li key={doc.id} className="rounded-[var(--radius-chip)] bg-bg-subtle px-3 py-2.5">
              <CheckboxField label={doc.name} checked={doc.provided} onChange={() => toggle(doc)} />
              <div className="pl-6">
                <SourceExcerptDisclosure excerpt={doc.sourceExcerpt} verifiable={doc.verifiable} />
                <RequiredDocNoteForm caseFileId={caseFileId} doc={doc} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Note libre par justificatif (US-5.3 AC2) : formulaire explicite avec bouton
 * « Enregistrer » (préféré à un `onBlur`/debounce, plus simple à tester
 * correctement). Une note réduite à des espaces est envoyée comme `null`
 * (retire la protection anti-ré-analyse posée en Task 1, qui ne porte que sur
 * `userNote` non vide) — pas comme une chaîne vide.
 */
function RequiredDocNoteForm({
  caseFileId,
  doc,
}: {
  caseFileId: string;
  doc: ResultRequiredDoc;
}) {
  const router = useRouter();
  const [note, setNote] = useState(doc.userNote ?? "");
  const [prevNote, setPrevNote] = useState(doc.userNote);
  if (doc.userNote !== prevNote) {
    setPrevNote(doc.userNote);
    setNote(doc.userNote ?? "");
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = note.trim();
    setBusy(true);
    setError(null);
    try {
      await updateRequiredDoc(caseFileId, doc.id, { userNote: trimmed === "" ? null : trimmed });
      router.refresh();
    } catch (err) {
      // Repli sur la note d'origine + message d'erreur inline : même esprit
      // que le rattrapage de `toggle()` ci-dessus (route limitée en débit).
      setNote(doc.userNote ?? "");
      setError(
        err instanceof ApiError ? err.message : "La modification n'a pas abouti. Réessayez.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="mt-2 flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="flex items-end gap-2">
        <TextField
          label="Note"
          value={note}
          disabled={busy}
          onChange={(event) => setNote(event.target.value)}
        />
        <Button type="submit" variant="secondary" fullWidth={false} disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
      {error ? <p className="text-xs font-medium text-error">{error}</p> : null}
    </form>
  );
}
