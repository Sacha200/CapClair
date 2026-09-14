"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CreateActionInput } from "@capclair/contract";
import { ApiError } from "@/lib/api/errors";
import { createAction } from "@/lib/api/cases";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

/**
 * US-5.2 AC2 — ajout manuel d'une action (écran 06). Repliée par défaut
 * derrière un bouton « Ajouter une action » ; à l'ouverture, titre (requis),
 * description et échéance (facultatifs — omis du corps de la requête si vides).
 * Soumission → `POST …/actions` puis `router.refresh()` et referme.
 */
export function ActionAddForm({ caseFileId }: { caseFileId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openForm() {
    setTitle("");
    setDescription("");
    setDueDate("");
    setError(null);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setError(null);
  }

  async function save() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Le titre est obligatoire.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const trimmedDescription = description.trim();
      const body: CreateActionInput = {
        title: trimmedTitle,
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
        ...(dueDate ? { dueDate } : {}),
      };
      await createAction(caseFileId, body);
      close();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'ajout n'a pas abouti. Réessayez.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" fullWidth={false} onClick={openForm}>
        Ajouter une action
      </Button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-[var(--radius-card-inner)] border border-border bg-bg-surface p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <TextField
        label="Titre"
        value={title}
        autoFocus
        disabled={busy}
        error={error ?? undefined}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
      />
      <TextField
        label="Description (facultatif)"
        value={description}
        disabled={busy}
        onChange={(event) => setDescription(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
      />
      <TextField
        type="date"
        label="Échéance (facultatif)"
        value={dueDate}
        disabled={busy}
        onChange={(event) => setDueDate(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
      />
      <div className="flex gap-2">
        <Button type="submit" fullWidth={false} disabled={busy}>
          {busy ? "Ajout…" : "Ajouter"}
        </Button>
        <Button type="button" variant="secondary" fullWidth={false} disabled={busy} onClick={close}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
