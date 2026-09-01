export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <section>
      <h1 className="text-2xl font-bold text-text-strong">Dossier</h1>
      <p className="mt-2 text-sm text-text-muted">
        Détail du dossier <code>{id}</code> — à construire (epics E4/E5).
      </p>
    </section>
  );
}
