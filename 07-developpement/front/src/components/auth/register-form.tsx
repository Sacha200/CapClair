"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RegisterInputSchema, type RegisterInput } from "@/lib/validation/auth";
import { register as registerApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { sanitizeNext } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { Alert } from "@/components/ui/alert";

export function RegisterForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(RegisterInputSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await registerApi(values);
      // Auto-login si l'e-mail était libre ; sinon le layout renverra vers /connexion.
      router.push(sanitizeNext(next, "/dashboard"));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) {
          for (const [field, message] of Object.entries(err.fields)) {
            setError(field as keyof RegisterInput, { message });
          }
          return;
        }
        setFormError(err.message);
        return;
      }
      setFormError("Une erreur est survenue. Réessayez dans un instant.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <TextField label="Nom" autoComplete="name" {...register("name")} error={errors.name?.message} />
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
      <CheckboxField
        label={
          <>
            J&apos;accepte les{" "}
            <Link href="/cgu" className="text-primary underline underline-offset-2">
              conditions générales d&apos;utilisation
            </Link>
            .
          </>
        }
        {...register("acceptCgu")}
        error={errors.acceptCgu?.message}
      />
      <CheckboxField
        label={
          <>
            J&apos;accepte la{" "}
            <Link href="/confidentialite" className="text-primary underline underline-offset-2">
              politique de confidentialité
            </Link>
            .
          </>
        }
        {...register("acceptPrivacy")}
        error={errors.acceptPrivacy?.message}
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Création…" : "Créer mon compte"}
      </Button>
    </form>
  );
}
