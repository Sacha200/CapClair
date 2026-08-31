import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold text-text-strong">Cette page n&apos;existe pas</h1>
      <p className="text-sm text-text-muted">Le lien est peut-être incorrect ou périmé.</p>
      <Link
        href="/dashboard"
        className="min-h-11 rounded-[var(--radius-button)] bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary"
      >
        Retour au tableau de bord
      </Link>
    </main>
  );
}
