import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, id, className, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

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
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-11 rounded-[var(--radius-field)] border bg-bg-surface px-3 text-sm text-text",
          "placeholder:text-text-muted focus-visible:border-primary",
          error ? "border-error" : "border-border-strong",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-xs font-medium text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
});
