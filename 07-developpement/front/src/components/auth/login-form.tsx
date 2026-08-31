"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AUTH_MESSAGES, LoginInputSchema, type LoginInput } from "@/lib/validation/auth";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { sanitizeNext } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Alert } from "@/components/ui/alert";

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(LoginInputSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values);
      router.push(sanitizeNext(next));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.isRateLimited ? AUTH_MESSAGES.tooManyAttempts : AUTH_MESSAGES.invalidCredentials);
        return;
      }
      setFormError("Une erreur est survenue. Réessayez dans un instant.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <TextField
        label="Adresse e-mail"
        type="email"
        autoComplete="email"
        {...register("email")}
        error={errors.email?.message}
      />
      <TextField
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        {...register("password")}
        error={errors.password?.message}
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Connexion…" : "Se connecter"}
      </Button>
      <Link
        href="/mot-de-passe-oublie"
        className="text-center text-sm text-primary underline underline-offset-2"
      >
        Mot de passe oublié ?
      </Link>
    </form>
  );
}
