"use client";

import { useRef, useState } from "react";
import { RiUpload2Line } from "@remixicon/react";
import { cn } from "@/lib/cn";
import { FILE_INPUT_ACCEPT } from "@/lib/validation/documents";

/**
 * Zone de dépôt (US-2.1 AC6) : glisser-déposer ET sélection de fichier — la
 * zone entière est un bouton, utilisable au clavier (DoD).
 */
export function Dropzone({
  onFile,
  disabled,
  label = "Déposez votre courrier ici, ou choisissez un fichier",
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  label?: string;
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
          "flex min-h-[150px] w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-card)]",
          "border-2 border-dashed border-border-strong bg-bg-surface px-4 py-6 text-center",
          "text-sm text-text transition-colors",
          "hover:border-primary hover:bg-primary-light focus-visible:border-primary",
          dragging && "border-primary bg-primary-light",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <RiUpload2Line size={28} className="text-primary" aria-hidden />
        <span className="font-medium text-text-strong">{label}</span>
        <span className="text-xs text-text-muted">PDF, PNG ou JPEG — 10 Mo maximum</span>
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
