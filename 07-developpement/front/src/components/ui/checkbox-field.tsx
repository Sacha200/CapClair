import { forwardRef, useId } from "react";
import { RiCheckLine } from "@remixicon/react";

interface CheckboxFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
  error?: string;
}

/**
 * Case à cocher personnalisée (revue de fidélité Figma, écran 06, node
 * 60:261) : 20×20, rayon 4px, coché = fond bleu primaire + coche blanche,
 * décoché = fond blanc + bordure. Même gabarit visuel que la case décorative
 * en lecture seule de l'écran 05 (`actions-list.tsx`), mais avec un vrai
 * `<input type="checkbox">` sous-jacent — `appearance-none` masque le rendu
 * natif, la coche (`RiCheckLine`) et le fond se pilotent en CSS pur via
 * `checked:`/`peer-checked:` pour rester corrects aussi bien en usage
 * contrôlé (`checked` prop, écran 06) qu'en usage non contrôlé
 * (`register()` de react-hook-form, formulaires d'auth/import).
 */
export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(function CheckboxField(
  { label, error, id, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorId = `${fieldId}-error`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2.5">
        <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
          <input
            ref={ref}
            id={fieldId}
            type="checkbox"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="peer absolute inset-0 size-5 shrink-0 cursor-pointer appearance-none rounded border-[1.5px] border-border-strong bg-bg-surface checked:border-primary checked:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
            {...props}
          />
          <RiCheckLine
            size={14}
            aria-hidden
            className="pointer-events-none absolute text-text-on-primary opacity-0 peer-checked:opacity-100"
          />
        </span>
        <label htmlFor={fieldId} className="text-sm text-text">
          {label}
        </label>
      </div>
      {error ? (
        <p id={errorId} className="pl-6 text-xs font-medium text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
});
