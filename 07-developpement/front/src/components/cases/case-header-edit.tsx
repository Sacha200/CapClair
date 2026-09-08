"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CaseFileResultResponse, UpdateCaseScalarsInput } from "@capclair/contract";
import { ApiError } from "@/lib/api/errors";
import { updateCaseScalars } from "@/lib/api/cases";
import { organismeLabel } from "@/lib/cases/result-format";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

type Organisme = CaseFileResultResponse["organisme"];

const ORGANISMES: Organisme[] = ["CAF", "CPAM", "FRANCE_TRAVAIL", "INDETERMINE"];

/**
 * US-4.4 AC1 — correction de l'en-tête du dossier : organisme, type de courrier
 * (titre) et date du courrier. Repliée par défaut. N'envoie que les champs
 * réellement modifiés ; ferme sans appel si rien n'a changé. Enregistrer appelle
 * `PATCH /api/dossiers/:id` puis `router.refresh()`. `Échap` annule.
 */
export function CaseHeaderEdit({
  caseFileId,
  organisme,
  title,
  documentDate,
}: {
  caseFileId: string;
  organisme: Organisme;
  title: string;
  documentDate: string | null;
}) {
  const router = useRouter();
  const originalDate = documentDate ? documentDate.slice(0, 10) : "";

  const [open, setOpen] = useState(false);
  const [org, setOrg] = useState<Organisme>(organisme);
  const [name, setName] = useState(title);
  const [date, setDate] = useState(originalDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openForm() {
    setOrg(organisme);
    setName(title);
    setDate(originalDate);
    setError(null);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setError(null);
  }

  async function save() {
    const patch: UpdateCaseScalarsInput = {};
    if (org !== organisme) patch.organisme = org;
    const trimmed = name.trim();
    if (trimmed && trimmed !== title) patch.title = trimmed;
    if (date !== originalDate) patch.documentDate = date || null;

    if (Object.keys(patch).length === 0) {
      close();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateCaseScalars(caseFileId, patch);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "La correction n'a pas abouti. Réessayez.",
      );
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openForm}
        className="text-xs font-semibold text-primary hover:underline"
      >
        Corriger l&apos;en-tête
      </button>
    );
  }

  return (
    <form
      className="mt-3 flex w-full flex-col gap-3 rounded-[var(--radius-card-inner)] border border-border bg-bg-surface p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-text-strong">
        Organisme
        <select
          value={org}
          disabled={busy}
          onChange={(event) => setOrg(event.target.value as Organisme)}
          className="min-h-11 rounded-[var(--radius-field)] border border-border-strong bg-bg-surface px-3 text-sm text-text"
        >
          {ORGANISMES.map((code) => (
            <option key={code} value={code}>
              {organismeLabel(code)}
            </option>
          ))}
        </select>
      </label>

      <TextField
        label="Type de courrier"
        value={name}
        disabled={busy}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
      />

      <TextField
        type="date"
        label="Date du courrier"
        value={date}
        disabled={busy}
        error={error ?? undefined}
        onChange={(event) => setDate(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
      />

      <div className="flex gap-2">
        <Button type="submit" fullWidth={false} disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button type="button" variant="secondary" fullWidth={false} disabled={busy} onClick={close}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
