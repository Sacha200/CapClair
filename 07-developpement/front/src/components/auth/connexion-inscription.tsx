"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";

type Tab = "connexion" | "inscription";

/**
 * Écran 01 : un seul formulaire, bascule Connexion / Inscription (pas deux
 * pages). L'onglet change l'état local, pas l'URL.
 */
export function ConnexionInscription({
  initialTab,
  next,
}: {
  initialTab: Tab;
  next: string | null;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Connexion ou inscription" className="flex gap-2">
        {(["connexion", "inscription"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "min-h-11 flex-1 rounded-[var(--radius-button)] border px-4 text-sm font-semibold capitalize",
              tab === value
                ? "border-primary bg-primary-light text-primary"
                : "border-border-strong bg-bg-surface text-text-muted hover:bg-bg-subtle",
            )}
          >
            {value}
          </button>
        ))}
      </div>

      {tab === "connexion" ? <LoginForm next={next} /> : <RegisterForm next={next} />}
    </div>
  );
}
