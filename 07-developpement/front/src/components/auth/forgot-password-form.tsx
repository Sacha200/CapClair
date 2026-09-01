"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AUTH_MESSAGES, ForgotInputSchema, type ForgotInput } from "@/lib/validation/auth";
import { forgotPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Alert } from "@/components/ui/alert";

export function ForgotPasswordForm() {
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotInput>({ resolver: zodResolver(ForgotInputSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await forgotPassword(values);
      setDone(true);
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.isRateLimited
          ? AUTH_MESSAGES.tooManyAttempts
          : "Une erreur est survenue. Réessayez dans un instant.",
      );
    }
  });

  if (done) {
    return <Alert tone="success">{AUTH_MESSAGES.forgotAcknowledged}</Alert>;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <p className="text-sm text-text-muted">
        Indiquez votre adresse e-mail : si un compte existe, vous recevrez un lien pour choisir un
        nouveau mot de passe.
      </p>
      <TextField
        label="Adresse e-mail"
        type="email"
        autoComplete="email"
        {...register("email")}
        error={errors.email?.message}
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Envoi…" : "Envoyer le lien"}
      </Button>
    </form>
  );
}
