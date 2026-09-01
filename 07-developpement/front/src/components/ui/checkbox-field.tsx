import { forwardRef, useId } from "react";

interface CheckboxFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
  error?: string;
}

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
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          {...props}
        />
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
