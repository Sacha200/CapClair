/**
 * Schémas de validation des formulaires d'auth. Source = le contrat partagé ;
 * les messages FR y sont déjà définis (persona Nadia, A2/B1).
 */
export {
  RegisterInputSchema,
  LoginInputSchema,
  ForgotInputSchema,
  ResetInputSchema,
  AUTH_MESSAGES,
} from "@capclair/contract";

export type { RegisterInput, LoginInput, ForgotInput, ResetInput } from "@capclair/contract";
