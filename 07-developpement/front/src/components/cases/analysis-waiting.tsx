"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RiLoader4Line } from "@remixicon/react";
import { ANALYSIS_MESSAGES, type CaseFileStatusResponse } from "@capclair/contract";
import { getCaseFile, startAnalysis } from "@/lib/api/cases";
import { ApiError } from "@/lib/api/errors";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Écran 04 — Attente d'analyse (I-13, D8 ; maquette node `1:16`).
 *
 * Un seul état visible à la fois selon `analysisStatus` (la maquette dessine le
 * cas nominal + une « variante échec » annotée) :
 *  - EN_ATTENTE / EN_COURS : indicateur + message d'attente, sortie toujours
 *    possible vers le tableau de bord (jamais bloqué sans action, cf. maquette).
 *  - ECHEC : message + « Relancer l'analyse » (ré-appelle `startAnalysis`).
 *  - TERMINEE : état minimal « Analyse terminée » — le rendu du résultat est
 *    l'écran 05 (epic E4), hors périmètre E3.
 *
 * Polling léger toutes les 2 s (doc archi §6) via un `setTimeout` ré-armé,
 * arrêté dès un état terminal ou au démontage. `reloadKey` relance le cycle
 * après un clic « Relancer ».
 */
const POLL_INTERVAL_MS = 2_000;

type View = "pending" | "done" | "failed" | "error";

function statusToView(status: CaseFileStatusResponse["analysisStatus"]): View {
  if (status === "TERMINEE") return "done";
  if (status === "ECHEC") return "failed";
  return "pending"; // EN_ATTENTE | EN_COURS
}

function messageFor(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.status > 0 ? err.message : fallback;
}

export function AnalysisWaiting({ caseFileId }: { caseFileId: string }) {
  const [view, setView] = useState<View>("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [relaunching, setRelaunching] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let consecutiveFailures = 0;

    async function tick() {
      try {
        const { analysisStatus } = await getCaseFile(caseFileId);
        if (cancelled) return;
        consecutiveFailures = 0;
        const next = statusToView(analysisStatus);
        setView(next);
        // Tant que l'analyse n'a pas abouti, on re-planifie une lecture.
        if (next === "pending") timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        // 404 = dossier inexistant / d'un autre compte → définitif. Le reste
        // (429 transitoire, 5xx, coupure réseau) : on continue de sonder, on
        // n'abandonne qu'après plusieurs échecs d'affilée.
        const definitive = err instanceof ApiError && err.status === 404;
        consecutiveFailures += 1;
        if (definitive || consecutiveFailures >= 5) {
          setView("error");
          setErrorMessage(
            messageFor(err, "Impossible de récupérer l'état de l'analyse. Réessayez dans un instant."),
          );
          return;
        }
        timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
      }
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [caseFileId, reloadKey]);

  async function handleRelaunch() {
    setRelaunching(true);
    setErrorMessage(null);
    try {
      await startAnalysis(caseFileId);
      setView("pending");
      setReloadKey((k) => k + 1); // relance le cycle de polling
    } catch (err) {
      setErrorMessage(messageFor(err, "La relance n'a pas abouti. Réessayez dans un instant."));
    } finally {
      setRelaunching(false);
    }
  }

  const backToDashboard = (
    <Link
      href="/dashboard"
      className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] border border-primary bg-bg-surface px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary-light"
    >
      Revenir au tableau de bord
    </Link>
  );

  return (
    <div className="mt-5 rounded-[var(--radius-card)] border border-border bg-bg-surface px-6 py-12 sm:px-10">
      {view === "pending" ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            className="flex size-[70px] items-center justify-center rounded-full border border-border bg-bg-subtle"
            aria-hidden
          >
            <RiLoader4Line size={32} className="animate-spin text-primary" />
          </span>
          <p
            className="mt-2 text-base font-semibold text-text-strong"
            role="status"
            aria-live="polite"
          >
            Analyse de votre courrier en cours…
          </p>
          <p className="text-sm text-text-muted">Cela prend généralement moins de 30 secondes.</p>
          <div className="mt-3">{backToDashboard}</div>
        </div>
      ) : null}

      {view === "done" ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-base font-semibold text-text-strong" role="status">
            Analyse terminée.
          </p>
          <p className="max-w-md text-sm text-text-muted">
            Le détail du résultat s&apos;affichera ici prochainement.
          </p>
          <div className="mt-3">{backToDashboard}</div>
        </div>
      ) : null}

      {view === "failed" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-start justify-between gap-3 rounded-[var(--radius-card-inner)] border border-border bg-bg-surface px-4 py-3.5 sm:flex-row sm:items-center">
            <p className="text-sm text-text">
              Une erreur est survenue pendant l&apos;analyse. Vos données n&apos;ont pas été perdues.
            </p>
            <Button
              fullWidth={false}
              onClick={() => void handleRelaunch()}
              disabled={relaunching}
              className="shrink-0"
            >
              {relaunching ? "Relance…" : "Relancer l'analyse"}
            </Button>
          </div>
          {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}
          <div>{backToDashboard}</div>
        </div>
      ) : null}

      {view === "error" ? (
        <div className="flex flex-col items-start gap-4">
          <Alert tone="error">{errorMessage ?? ANALYSIS_MESSAGES.analysisFailed}</Alert>
          {backToDashboard}
        </div>
      ) : null}
    </div>
  );
}
