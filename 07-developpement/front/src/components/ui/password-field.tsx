"use client";

import { forwardRef, useId, useState } from "react";
import { RiEyeLine, RiEyeOffLine } from "@remixicon/react";
import { cn } from "@/lib/cn";

interface PasswordFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * Champ mot de passe avec bouton afficher / masquer (œil).
 * Aide le persona Nadia à vérifier ce qu'elle saisit. Le bouton est un vrai
 * `<button>` avec `aria-pressed` et un `aria-label` qui change ; l'icône est
 * décorative (`aria-hidden`). Cible ≥ 44 px.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField({ label, error, hint, id, className, ...props }, ref) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const errorId = `${fieldId}-error`;
    const hintId = `${fieldId}-hint`;
    const [visible, setVisible] = useState(false);
    const describedBy =
      [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-medium text-text-strong">
          {label}
        </label>
        {hint ? (
          <p id={hintId} className="text-xs text-text-muted">
            {hint}
          </p>
        ) : null}
        <div className="relative">
          <input
            ref={ref}
            id={fieldId}
            type={visible ? "text" : "password"}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              "min-h-11 w-full rounded-[var(--radius-field)] border bg-bg-surface py-2 pl-3 pr-12 text-sm text-text",
              "placeholder:text-text-muted focus-visible:border-primary",
              error ? "border-error" : "border-border-strong",
              className,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-text-muted hover:text-text"
          >
            {visible ? (
              <RiEyeOffLine size={18} aria-hidden />
            ) : (
              <RiEyeLine size={18} aria-hidden />
            )}
          </button>
        </div>
        {error ? (
          <p id={errorId} className="text-xs font-medium text-error">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
