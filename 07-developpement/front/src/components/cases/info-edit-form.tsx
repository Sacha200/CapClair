"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ResultInfo } from "@capclair/contract";
import { ApiError } from "@/lib/api/errors";
import { updateExtractedInfo } from "@/lib/api/cases";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

/**
 * US-4.4 — correction en ligne d'une information extraite. Repliée par défaut
 * (« Corriger cette information ») ; à l'ouverture, un champ pré-rempli avec la
 * valeur courante. Enregistrer appelle `PATCH …/informations/:infoId` puis
 * `router.refresh()` — le server component re-fetch et le rendu reflète la
 * correction (nouvelle valeur, confiance ELEVE). `Échap` annule.
 */
export function InfoEditForm({ caseFileId, info }: { caseFileId: string; info: ResultInfo }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(info.value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openForm() {
    setValue(info.value);
    setError(null);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setError(null);
  }

  async function save() {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("La valeur ne peut pas être vide.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateExtractedInfo(caseFileId, info.id, { value: trimmed });
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
        className="mt-1 text-xs font-semibold text-primary hover:underline"
      >
        Corriger cette information
      </button>
    );
  }

  return (
    <form
      className="mt-2 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <TextField
        label={`Corriger « ${info.label || info.categoryLabel} »`}
        value={value}
        autoFocus
        disabled={busy}
        error={error ?? undefined}
        onChange={(event) => setValue(event.target.value)}
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
