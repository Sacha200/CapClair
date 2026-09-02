"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import {
  confirmFictional,
  deleteDocument,
  replaceDocument,
  uploadDocument,
} from "@/lib/api/documents";
import {
  DOCUMENT_MESSAGES,
  validateFile,
  type UploadDocumentResponse,
} from "@/lib/validation/documents";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { Dropzone } from "@/components/documents/dropzone";
import { DocumentPreview } from "@/components/documents/document-preview";

/**
 * Écran 03 — Import d'un courrier (US-2.1, 2.2, 2.3, 2.6).
 *
 * Machine d'état : `idle` (dropzone) → `busy` (upload/remplacement) →
 * `ready` (document en place, lisible ou non) ; les erreurs re-basculent vers
 * l'état précédent avec un message. Le serveur reste l'autorité : tout message
 * d'erreur API est réaffiché tel quel (messages FR du contrat).
 */
export function ImportForm() {
  const router = useRouter();
  const [doc, setDoc] = useState<UploadDocumentResponse | null>(null);
  // Incrémenté à chaque upload/remplacement réussi : l'URL d'aperçu ne change
  // pas après un `replace` (même documentId) — la clé force le remontage de
  // l'iframe/img, donc le re-fetch du fichier.
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState<null | "upload" | "replace" | "remove" | "start">(null);
  const [error, setError] = useState<string | null>(null);
  const [fictionalConfirmed, setFictionalConfirmed] = useState(false);

  function messageFor(err: unknown): string {
    if (err instanceof ApiError && err.isRateLimited) return err.message;
    if (err instanceof ApiError && err.status > 0) return err.message;
    return "Une erreur est survenue. Réessayez dans un instant.";
  }

  async function handleFile(file: File) {
    setError(null);
    const invalid = validateFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(doc ? "replace" : "upload");
    try {
      const next = doc ? await replaceDocument(doc.documentId, file) : await uploadDocument(file);
      setDoc(next);
      setRevision((current) => current + 1);
      setFictionalConfirmed(false); // nouveau fichier → nouveau consentement (US-2.3)
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(null);
    }
  }

  /** « Retirer » (US-2.2 AC2) : supprime document + dossier, retour à la dropzone. */
  async function handleRemove() {
    if (!doc) return;
    setError(null);
    setBusy("remove");
    try {
      await deleteDocument(doc.documentId);
      setDoc(null);
      setFictionalConfirmed(false);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleCancel() {
    if (doc) {
      await deleteDocument(doc.documentId).catch(() => {});
    }
    router.push("/dashboard");
  }

  /** US-2.3 AC1/AC2 : le cochage enregistre le consentement immédiatement. */
  async function handleFictionalChange(checked: boolean) {
    setFictionalConfirmed(checked);
    if (!checked || !doc) return;
    try {
      await confirmFictional(doc.documentId);
    } catch (err) {
      setFictionalConfirmed(false);
      setError(messageFor(err));
    }
  }

  /** Placeholder E3 (décision #9 du plan) : le déclencheur d'analyse arrive en US-3.1. */
  async function handleStartAnalysis() {
    if (!doc) return;
    setBusy("start");
    router.push(`/dossiers/${doc.caseFileId}`);
  }

  const readable = doc?.readable === true;
  const canStart = readable && fictionalConfirmed && busy === null;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      {/* Colonne formulaire */}
      <div className="flex flex-col gap-4">
        {error ? <Alert tone="error">{error}</Alert> : null}

        {!doc ? (
          <Dropzone
            onFile={handleFile}
            disabled={busy !== null}
            label={busy === "upload" ? "Import en cours…" : undefined}
          />
        ) : (
          <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-bg-surface p-4">
            <div>
              <p className="text-sm font-semibold text-text-strong">{doc.originalName}</p>
              <p className="mt-0.5 text-xs text-text-muted">
                {doc.kind === "pdf" ? "PDF" : "Image"}
                {doc.pageCount ? ` — ${doc.pageCount} page${doc.pageCount > 1 ? "s" : ""}` : ""}
                {` — ${Math.max(1, Math.round(doc.sizeBytes / 1024))} Ko`}
              </p>
            </div>

            {!readable ? (
              <div className="flex flex-col gap-2">
                <Alert tone="error">{DOCUMENT_MESSAGES.unreadable}</Alert>
                <ul className="list-disc pl-6 text-sm text-text">
                  {DOCUMENT_MESSAGES.unreadableSuggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="secondary"
                onClick={handleRemove}
                disabled={busy !== null}
                className="sm:flex-1"
              >
                {busy === "remove" ? "Retrait…" : "Retirer"}
              </Button>
              <div className="sm:flex-1">
                <Dropzone
                  onFile={handleFile}
                  disabled={busy !== null}
                  label={busy === "replace" ? "Remplacement…" : "Choisir un autre fichier"}
                />
              </div>
            </div>
          </div>
        )}

        <CheckboxField
          label="Je confirme que ce document est fictif"
          checked={fictionalConfirmed}
          disabled={!readable || busy !== null}
          onChange={(event) => void handleFictionalChange(event.target.checked)}
        />

        <Button onClick={handleStartAnalysis} disabled={!canStart}>
          Lancer l&apos;analyse
        </Button>
        <Button variant="secondary" onClick={handleCancel} disabled={busy !== null}>
          Annuler
        </Button>
      </div>

      {/* Colonne aperçu (US-2.2 AC1) */}
      <div>
        {doc ? (
          <DocumentPreview key={`${doc.documentId}-${revision}`} id={doc.documentId} kind={doc.kind} />
        ) : (
          <div className="flex h-full min-h-[320px] items-center justify-center rounded-[var(--radius-card)] border border-border bg-bg-subtle p-6 text-sm text-text-muted">
            L&apos;aperçu de votre courrier s&apos;affichera ici.
          </div>
        )}
      </div>
    </div>
  );
}
