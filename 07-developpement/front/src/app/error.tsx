"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold text-text-strong">Une erreur est survenue</h1>
      <p className="text-sm text-text-muted">Réessayez dans un instant.</p>
      <button
        type="button"
        onClick={reset}
        className="min-h-11 rounded-[var(--radius-button)] bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary"
      >
        Réessayer
      </button>
    </main>
  );
}
