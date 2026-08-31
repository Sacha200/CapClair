"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { AUTH_MESSAGES, ResetInputSchema, type ResetInput } from "@/lib/validation/auth";
import { resetPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Alert } from "@/components/ui/alert";

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetInput>({
    resolver: zodResolver(ResetInputSchema),
    defaultValues: { token },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await resetPassword(values);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(
          err.isRateLimited ? AUTH_MESSAGES.tooManyAttempts : err.message || AUTH_MESSAGES.resetLinkInvalid,
        );
        return;
      }
      setFormError("Une erreur est survenue. Réessayez dans un instant.");
    }
  });

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">
          Votre mot de passe a été changé. Vous pouvez maintenant vous connecter.
        </Alert>
        <Link
          href="/connexion"
          className="text-center text-sm font-semibold text-primary underline underline-offset-2"
        >
          Aller à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <input type="hidden" {...register("token")} />
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <TextField
        label="Nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        hint="Au moins 12 caractères."
        {...register("password")}
        error={errors.password?.message}
      />
      <TextField
        label="Confirmer le mot de passe"
        type="password"
        autoComplete="new-password"
        {...register("passwordConfirm")}
        error={errors.passwordConfirm?.message}
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Enregistrement…" : "Changer le mot de passe"}
      </Button>
    </form>
  );
}
