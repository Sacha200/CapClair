import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary";

export function Button({
  variant = "primary",
  // Pleine largeur par défaut (écrans d'auth, maquette 01) ; `false` pour un
  // bouton dimensionné à son contenu (ex. paire Annuler / Lancer l'analyse
  // alignée à droite, maquette 03).
  fullWidth = true,
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; fullWidth?: boolean }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-button)]",
        "px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        fullWidth && "w-full",
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
