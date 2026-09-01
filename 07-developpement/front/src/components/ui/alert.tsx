import { RiErrorWarningLine, RiCheckboxCircleLine, RiInformationLine } from "@remixicon/react";
import { cn } from "@/lib/cn";

type Tone = "error" | "success" | "info";

const TONES: Record<Tone, { icon: typeof RiInformationLine; className: string }> = {
  error: { icon: RiErrorWarningLine, className: "border-error bg-error-light text-error" },
  success: { icon: RiCheckboxCircleLine, className: "border-success bg-success-light text-success" },
  info: { icon: RiInformationLine, className: "border-primary bg-primary-light text-primary" },
};

/** Message d'état : icône + texte (jamais la couleur seule — accessibilité). */
export function Alert({
  tone = "error",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  const { icon: Icon, className } = TONES[tone];
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-[var(--radius-chip)] border px-3 py-2.5 text-sm",
        className,
      )}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
      <span className="text-text-strong">{children}</span>
    </div>
  );
}
