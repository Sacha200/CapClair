"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { updateMainDeadline } from "@/lib/api/cases";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

/** ISO (`2026-07-03T00:00:00.000Z`) → valeur d'un `<input type="date">`. */
function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

/**
 * US-4.4 AC5 — correction de l'échéance principale. Repliée par défaut
 * (« Corriger l'échéance ») ; à l'ouverture, un `<input type="date">` borné à
 * la date du courrier (`min`). Enregistrer appelle `PATCH …/echeance` puis
 * `router.refresh()`. Le `400 deadline_before_document` du serveur est affiché
 * tel quel. `Échap` annule.
 */
export function DeadlineEditDialog({
  caseFileId,
  currentDate,
  minDate,
}: {
  caseFileId: string;
  currentDate: string | null;
  minDate: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(toDateInput(currentDate));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openForm() {
    setDate(toDateInput(currentDate));
    setError(null);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setError(null);
  }

  async function save() {
    if (!date) {
      setError("Choisissez une date.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateMainDeadline(caseFileId, { date });
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
        Corriger l&apos;échéance
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <TextField
        type="date"
        label="Nouvelle date d'échéance"
        value={date}
        min={minDate ?? undefined}
        autoFocus
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
