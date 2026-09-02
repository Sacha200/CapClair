"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { FILE_INPUT_ACCEPT } from "@/lib/validation/documents";

/**
 * Zone de dépôt (US-2.1 AC6) : glisser-déposer ET sélection de fichier — la
 * zone entière est un bouton, utilisable au clavier (DoD). Copie et style
 * fidèles à la maquette Hi-Fi (écran 03) : pas d'icône, deux lignes de texte.
 * Formats réellement acceptés (PDF, PNG, JPEG — `FILE_INPUT_ACCEPT`) plus
 * larges que la copie « PDF » : un import image reste possible, il finit
 * simplement toujours dans le parcours « document illisible » (OCR coupé,
 * US-2.5) — la maquette oriente donc volontairement vers le PDF.
 */
export function Dropzone({
  onFile,
  disabled,
  label = "Glissez un fichier PDF ici",
  hint = "ou cliquez pour parcourir",
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex min-h-[150px] flex-1 w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-card)]",
          "border-[1.5px] border-dashed border-border-strong bg-bg-subtle px-5 py-7 text-center",
          "transition-colors",
          "hover:border-primary hover:bg-primary-light focus-visible:border-primary",
          dragging && "border-primary bg-primary-light",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="text-sm font-semibold text-text">{label}</span>
        <span className="text-[13px] text-text-muted">{hint}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={FILE_INPUT_ACCEPT}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = ""; // permet de re-choisir le même fichier
        }}
      />
    </>
  );
}
