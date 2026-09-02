"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api/errors";
import {
  confirmFictional,
  deleteDocument,
  documentFileSrc,
  replaceDocument,
  uploadDocument,
} from "@/lib/api/documents";
import { confirmAiConsent, startAnalysis } from "@/lib/api/cases";
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
 * Écran 03 — Import d'un courrier (US-2.1, 2.2, 2.3, 2.6, 3.1).
 *
 * Structure et styles fidèles à la maquette Hi-Fi (node `32:173`, page
 * ✨ Hi-Fi du fichier Figma) : PAS de carte englobante — chaque bloc porte
 * son propre fond (aperçu et statut fichier en blanc, panneau de
 * confirmation teinté), posés directement sur le fond de page. Écarts
 * documentés :
 *  - le bloc « aperçu » de la maquette est un mock statique (bandeau rouge +
 *    lignes grises) ; ici c'est le vrai document rendu via la route
 *    authentifiée (DocumentPreview) — plus fidèle à l'usage réel. Le bandeau
 *    « DOCUMENT FICTIF — DÉMONSTRATION » apparaît naturellement : il fait
 *    partie du contenu réel des courriers fictifs du corpus.
 *  - le panneau de confirmation change de ton (orange tant que non coché →
 *    neutre une fois coché) : comportement déduit, la maquette ne montre que
 *    l'état non coché.
 *  - « Retirer le document » (lien discret) n'apparaît pas dans le mock
 *    statique mais reste nécessaire (US-2.2 AC2).
 *
 * Machine d'état : `idle` (dropzone) → `busy` (upload/remplacement) →
 * `ready` (document en place, lisible ou non). Le serveur reste l'autorité :
 * tout message d'erreur API est réaffiché tel quel (messages FR du contrat).
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
  // Consentement IA (US-3.1) — distinct de la confirmation « document fictif »
  // (AC2). Coché en mémoire ici ; la ligne ConsentLog AI_PROCESSING n'est
  // écrite qu'au déclenchement (confirmAiConsent + startAnalysis).
  const [aiConsentChecked, setAiConsentChecked] = useState(false);

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
      setAiConsentChecked(false);
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
      setAiConsentChecked(false);
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
    if (!checked) {
      // L'étape de consentement IA est masquée : on repart de zéro (US-3.1 AC2).
      setAiConsentChecked(false);
      return;
    }
    if (!doc) return;
    try {
      await confirmFictional(doc.documentId);
    } catch (err) {
      setFictionalConfirmed(false);
      setError(messageFor(err));
    }
  }

  /**
   * Déclenchement de l'analyse (US-3.1 AC3) : enregistre le consentement
   * `AI_PROCESSING` (distinct de « document fictif », AC2) PUIS enfile
   * l'analyse, avant de rediriger vers l'écran d'attente (écran 04, D8).
   */
  async function handleStartAnalysis() {
    if (!doc || !aiConsentChecked) return;
    setError(null);
    setBusy("start");
    try {
      await confirmAiConsent(doc.caseFileId);
      await startAnalysis(doc.caseFileId);
      router.push(`/dossiers/${doc.caseFileId}`);
    } catch (err) {
      // 409 : une analyse tourne déjà pour ce dossier — l'écran d'attente est
      // exactement là où l'utilisateur doit aller, pas un message d'erreur.
      if (err instanceof ApiError && err.status === 409) {
        router.push(`/dossiers/${doc.caseFileId}`);
        return;
      }
      setError(messageFor(err));
      setBusy(null);
    }
  }

  const readable = doc?.readable === true;
  const checkboxEnabled = readable && busy === null;
  // Le consentement IA n'apparaît qu'une fois le caractère fictif confirmé —
  // il se lit alors comme une étape (plan E3 §7), et reste une case distincte.
  const showAiConsent = checkboxEnabled && fictionalConfirmed;
  const canStart = readable && fictionalConfirmed && aiConsentChecked && busy === null;

  return (
    <div className="mt-5 flex flex-col items-start gap-5">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex w-full items-start gap-5 max-lg:flex-col">
        {/* Colonne aperçu (US-2.2 AC1) — extensible */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 self-stretch">
          <p className="text-sm font-semibold text-text-strong">Aperçu du document</p>
          <div className="flex flex-1 flex-col gap-2.5 rounded-[var(--radius-card)] border border-border bg-bg-surface px-8 py-6">
            {doc ? (
              <>
                <DocumentPreview key={`${doc.documentId}-${revision}`} id={doc.documentId} kind={doc.kind} />
                <a
                  href={documentFileSrc(doc.documentId)}
                  target="_blank"
                  rel="noreferrer"
                  className="self-start text-[13px] font-semibold text-primary hover:underline"
                >
                  ⤢ Voir en plein écran
                </a>
              </>
            ) : (
              <div className="flex min-h-[280px] flex-1 items-center justify-center text-center text-sm text-text-muted">
                L&apos;aperçu de votre courrier s&apos;affichera ici.
              </div>
            )}
          </div>
        </div>

        {/* Colonne dépôt/statut — largeur fixe */}
        <div className="flex w-full flex-col gap-3 self-stretch lg:w-[360px] lg:shrink-0">
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
            hint={doc ? undefined : "ou cliquez pour parcourir"}
          />

          {doc ? (
            <div className="flex items-center justify-between gap-2 rounded-[var(--radius-card-inner)] border border-border bg-bg-surface px-3.5 py-3">
              <p className="min-w-0 truncate text-sm text-text">
                {doc.originalName} · {Math.max(1, Math.round(doc.sizeBytes / 1024))} Ko
              </p>
              <span
                className={cn(
                  "shrink-0 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-semibold",
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

      {/* Panneau de confirmation (US-2.3 AC1) : ton alerte tant que non coché. */}
      <div
        className={cn(
          "w-full rounded-[var(--radius-card-inner)] border px-3.5 py-3",
          checkboxEnabled && !fictionalConfirmed
            ? "border-warning bg-warning-light"
            : "border-border bg-bg-surface",
        )}
      >
        <CheckboxField
          label="Je confirme qu'il s'agit d'un document fictif et je comprends que CapClair ne doit pas être utilisé avec de vrais courriers administratifs."
          checked={fictionalConfirmed}
          disabled={!checkboxEnabled}
          onChange={(event) => void handleFictionalChange(event.target.checked)}
        />
      </div>
      {/* Étape de consentement IA (US-3.1) — distincte de « document fictif »
          (AC2), nomme explicitement le prestataire externe (AC1). */}
      {showAiConsent ? (
        <div
          className={cn(
            "w-full rounded-[var(--radius-card-inner)] border px-3.5 py-3",
            aiConsentChecked ? "border-border bg-bg-surface" : "border-warning bg-warning-light",
          )}
        >
          <p className="mb-2 text-sm text-text">
            Pour analyser votre courrier, CapClair en envoie le texte à{" "}
            <span className="font-semibold">Anthropic</span>, une entreprise d&apos;intelligence
            artificielle située hors de l&apos;Union européenne. Le texte n&apos;est utilisé que
            pour produire l&apos;analyse.
          </p>
          <CheckboxField
            label="J'autorise l'envoi du texte de mon courrier à Anthropic pour réaliser l'analyse."
            checked={aiConsentChecked}
            disabled={busy !== null}
            onChange={(event) => setAiConsentChecked(event.target.checked)}
          />
        </div>
      ) : null}

      <p className="-mt-3 text-xs text-text-muted">
        {showAiConsent
          ? "L'analyse ne démarrera qu'après avoir coché ces deux cases."
          : "L'analyse ne démarrera qu'après avoir coché cette case."}
      </p>

      <div className="flex w-full items-center justify-end gap-3">
        <Button variant="secondary" fullWidth={false} onClick={handleCancel} disabled={busy !== null}>
          Annuler
        </Button>
        <Button fullWidth={false} onClick={handleStartAnalysis} disabled={!canStart}>
          {busy === "start" ? "Démarrage…" : "Lancer l'analyse"}
        </Button>
      </div>
    </div>
  );
}
