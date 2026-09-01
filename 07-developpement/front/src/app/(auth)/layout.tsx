export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <span className="text-xl font-extrabold tracking-tight text-text-strong">CapClair</span>
      {children}
      <p className="max-w-md text-center text-xs text-text-muted">
        CapClair vous aide à comprendre vos courriers administratifs. Ce n&apos;est pas
        l&apos;administration : vérifiez toujours les informations importantes.
      </p>
    </main>
  );
}
