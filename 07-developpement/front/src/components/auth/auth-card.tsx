export function AuthCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-md rounded-[var(--radius-container)] border border-border bg-bg-surface p-6 shadow-sm sm:p-8">
      <h1 className="mb-6 text-2xl font-bold text-text-strong">{title}</h1>
      {children}
    </div>
  );
}
