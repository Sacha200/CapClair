import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Alert } from "@/components/ui/alert";
import { AUTH_MESSAGES } from "@/lib/validation/auth";

export default async function ReinitialiserPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthCard title="Choisir un nouveau mot de passe">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="flex flex-col gap-4">
          <Alert tone="error">{AUTH_MESSAGES.resetLinkInvalid}</Alert>
          <Link
            href="/mot-de-passe-oublie"
            className="text-center text-sm font-semibold text-primary underline underline-offset-2"
          >
            Demander un nouveau lien
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
