import { AuthCard } from "@/components/auth/auth-card";
import { ConnexionInscription } from "@/components/auth/connexion-inscription";

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; tab?: string }>;
}) {
  const { next, tab } = await searchParams;
  const initialTab = tab === "inscription" ? "inscription" : "connexion";

  return (
    <AuthCard title={initialTab === "inscription" ? "Créer un compte" : "Se connecter"}>
      <ConnexionInscription initialTab={initialTab} next={next ?? null} />
    </AuthCard>
  );
}
