import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function MotDePasseOubliePage() {
  return (
    <AuthCard title="Mot de passe oublié">
      <ForgotPasswordForm />
      <Link
        href="/connexion"
        className="mt-4 block text-center text-sm text-primary underline underline-offset-2"
      >
        Retour à la connexion
      </Link>
    </AuthCard>
  );
}
