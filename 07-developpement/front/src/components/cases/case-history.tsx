"use client";

import { useEffect, useState } from "react";
import type { HistoryEntry } from "@capclair/contract";
import { getCaseHistory } from "@/lib/api/cases";
import { ResultCard } from "./result-card";

/**
 * US-4.5 — section « Historique du dossier » de l'écran 05. Chargée côté client
 * après le rendu (l'historique est secondaire, priorité S) : tant qu'il est
 * vide, non chargé ou en erreur, la section ne s'affiche pas — elle ne doit
 * jamais gêner la lecture du résultat.
 *
 * Les libellés viennent déjà humanisés du serveur (AC2) et ne portent aucun
 * contenu de courrier (AC3).
 */
function formatEntryDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function CaseHistory({ caseFileId }: { caseFileId: string }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCaseHistory(caseFileId)
      .then((res) => {
        if (!cancelled) setEntries(res.entries);
      })
      .catch(() => {
        // Section secondaire (priorité S) : en cas d'échec on la laisse
        // simplement masquée (`entries` reste `null`).
      });
    return () => {
      cancelled = true;
    };
  }, [caseFileId]);

  if (!entries || entries.length === 0) return null;

  return (
    <ResultCard title="Historique du dossier" titleId="history-title">
      <ol className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-col gap-0.5 border-t border-border pt-2 first:border-t-0 first:pt-0 sm:flex-row sm:gap-3"
          >
            <time dateTime={entry.at} className="shrink-0 text-xs text-text-muted">
              {formatEntryDate(entry.at)}
            </time>
            <span className="text-sm text-text">{entry.label}</span>
          </li>
        ))}
      </ol>
    </ResultCard>
  );
}
