import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/app/app-header";
import { Footer } from "@/components/app/footer";

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
    <div className="flex min-h-dvh flex-col">
      <AppHeader user={session} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-10">{children}</main>
      <Footer />
    </div>
  );
}
