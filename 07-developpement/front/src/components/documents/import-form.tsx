"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RiFullscreenLine } from "@remixicon/react";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api/errors";
import {
  confirmFictional,
  deleteDocument,
  documentFileSrc,
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
 * Structure alignée sur la maquette Figma (node 1:12, « CapClair — Wireframes
 * MVP ») : aperçu à gauche (colonne extensible) + zone de dépôt/statut à
 * droite (colonne fixe), case de consentement pleine largeur, actions
 * alignées à droite. Écart documenté : le bloc « aperçu » de la maquette est
 * un mock statique (bandeau + lignes) — ici c'est le vrai document rendu via
 * la route authentifiée (DocumentPreview), donc plus fidèle à l'usage réel
 * qu'une reproduction du mock.
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
    <div className="mt-6 rounded-[var(--radius-card)] border border-border bg-bg-surface p-4 sm:p-[18px]">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className={cn("flex flex-col gap-4 lg:flex-row", error && "mt-4")}>
        {/* Colonne aperçu (US-2.2 AC1) — extensible, à gauche */}
        <div className="flex flex-1 flex-col gap-1.5">
          <p className="text-xs font-semibold text-text-strong">Aperçu du document</p>
          {doc ? (
            <>
              <DocumentPreview key={`${doc.documentId}-${revision}`} id={doc.documentId} kind={doc.kind} />
              <a
                href={documentFileSrc(doc.documentId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 self-start text-xs font-medium text-text-muted hover:text-text"
              >
                <RiFullscreenLine size={14} aria-hidden />
                Voir en plein écran
              </a>
            </>
          ) : (
            <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-[var(--radius-card-inner)] border border-border bg-bg-subtle p-6 text-center text-sm text-text-muted">
              L&apos;aperçu de votre courrier s&apos;affichera ici.
            </div>
          )}
        </div>

        {/* Colonne dépôt/statut — largeur fixe, à droite */}
        <div className="flex flex-col gap-3 lg:w-[360px] lg:shrink-0">
          <Dropzone
            onFile={handleFile}
            disabled={busy !== null}
            label={
              busy === "upload"
                ? "Import en cours…"
                : busy === "replace"
                  ? "Remplacement…"
                  : doc
                    ? "Choisir un autre fichier"
                    : undefined
            }
          />

          {doc ? (
            <div className="flex items-center justify-between gap-2 rounded-[var(--radius-field)] border border-border bg-bg-surface px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-text-strong">{doc.originalName}</p>
                <p className="text-xs text-text-muted">
                  {doc.kind === "pdf" ? "PDF" : "Image"}
                  {doc.pageCount ? ` — ${doc.pageCount} page${doc.pageCount > 1 ? "s" : ""}` : ""}
                  {` — ${Math.max(1, Math.round(doc.sizeBytes / 1024))} Ko`}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-medium",
                  readable ? "bg-success-light text-success" : "bg-error-light text-error",
                )}
              >
                {readable ? "Aperçu chargé" : "Document illisible"}
              </span>
            </div>
          ) : null}

          {doc ? (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy !== null}
              className="self-start text-sm text-primary underline underline-offset-2 disabled:opacity-60"
            >
              {busy === "remove" ? "Retrait…" : "Retirer le document"}
            </button>
          ) : null}

          {doc && !readable ? (
            <div className="flex flex-col gap-2">
              <Alert tone="error">{DOCUMENT_MESSAGES.unreadable}</Alert>
              <ul className="list-disc pl-6 text-sm text-text">
                {DOCUMENT_MESSAGES.unreadableSuggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <CheckboxField
          label="Je confirme qu'il s'agit d'un document fictif et je comprends que CapClair ne doit pas être utilisé avec de vrais courriers administratifs."
          checked={fictionalConfirmed}
          disabled={!readable || busy !== null}
          onChange={(event) => void handleFictionalChange(event.target.checked)}
        />
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2.5">
        <Button variant="secondary" fullWidth={false} onClick={handleCancel} disabled={busy !== null}>
          Annuler
        </Button>
        <Button fullWidth={false} onClick={handleStartAnalysis} disabled={!canStart}>
          Lancer l&apos;analyse
        </Button>
      </div>
    </div>
  );
}
