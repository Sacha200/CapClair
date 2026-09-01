import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/app/app-header";

// Garde autoritaire (US-1.4) : re-vérifiée à chaque rendu, jamais mise en cache
// → un retour arrière navigateur après déconnexion ne réaffiche pas la page.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    // Cas courant (cookie absent) : le middleware a déjà redirigé avec ?next.
    // Ici on couvre le cookie présent mais invalide (déconnexion / reset ailleurs).
    redirect("/connexion");
  }

  return (
    <div className="min-h-dvh">
      <AppHeader user={session} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-10">{children}</main>
    </div>
  );
}
