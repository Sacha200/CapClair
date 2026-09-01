import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary";

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-button)]",
        "px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" &&
          "bg-primary text-text-on-primary hover:bg-primary-hover active:bg-primary-active",
        variant === "secondary" &&
          "border border-border-strong bg-bg-surface text-text hover:bg-bg-subtle",
        className,
      )}
      {...props}
    />
  );
}
