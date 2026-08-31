import { z } from "zod";

/** Messages d'erreur — repris à l'identique dans l'UI (persona Nadia, A2/B1). */
export const AUTH_MESSAGES = {
  passwordTooShort: "Le mot de passe doit contenir au moins 12 caractères.",
  passwordMismatch: "Les mots de passe ne correspondent pas.",
  cguRequired: "Vous devez accepter les conditions générales d'utilisation.",
  privacyRequired: "Vous devez accepter la politique de confidentialité.",
  invalidCredentials: "Identifiants incorrects.",
  resetLinkInvalid: "Ce lien n'est plus valide.",
  emailInvalid: "Adresse e-mail invalide.",
  nameRequired: "Veuillez indiquer votre nom.",
  forgotAcknowledged:
    "Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d'être envoyé.",
  tooManyAttempts: "Trop de tentatives. Réessayez dans quelques minutes.",
} as const;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { message: AUTH_MESSAGES.emailInvalid })
  .email({ message: AUTH_MESSAGES.emailInvalid });

const password = z.string().min(12, { message: AUTH_MESSAGES.passwordTooShort });

const acceptedCheckbox = (message: string) =>
  z.boolean().refine((v) => v === true, { message });

export const RegisterInputSchema = z
  .object({
    name: z.string().trim().min(1, { message: AUTH_MESSAGES.nameRequired }).max(120),
    email,
    password,
    passwordConfirm: z.string(),
    acceptCgu: acceptedCheckbox(AUTH_MESSAGES.cguRequired),
    acceptPrivacy: acceptedCheckbox(AUTH_MESSAGES.privacyRequired),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    path: ["passwordConfirm"],
    message: AUTH_MESSAGES.passwordMismatch,
  });

export const LoginInputSchema = z.object({
  email,
  password: z.string().min(1),
});

export const ForgotInputSchema = z.object({ email });

export const ResetInputSchema = z
  .object({
    token: z.string().min(1),
    password,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    path: ["passwordConfirm"],
    message: AUTH_MESSAGES.passwordMismatch,
  });

/** Utilisateur exposé au client (jamais de hash ni de métadonnées internes). */
export const SessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
});

export const SessionResponseSchema = z.object({ user: SessionUserSchema });
export const AuthOkResponseSchema = z.object({
  ok: z.literal(true),
  user: SessionUserSchema.optional(),
});
export const ForgotResponseSchema = z.object({ status: z.literal("ok") });

export type RegisterInput = z.infer<typeof RegisterInputSchema>;
export type LoginInput = z.infer<typeof LoginInputSchema>;
export type ForgotInput = z.infer<typeof ForgotInputSchema>;
export type ResetInput = z.infer<typeof ResetInputSchema>;
export type SessionUser = z.infer<typeof SessionUserSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
export type AuthOkResponse = z.infer<typeof AuthOkResponseSchema>;
export type ForgotResponse = z.infer<typeof ForgotResponseSchema>;
