/** DTO d'auth — source unique = le contrat partagé (@capclair/contract). */
export {
  RegisterInputSchema,
  LoginInputSchema,
  ForgotInputSchema,
  ResetInputSchema,
  SessionUserSchema,
  SessionResponseSchema,
  AuthOkResponseSchema,
  ForgotResponseSchema,
  AUTH_MESSAGES,
  AUTH_PATHS,
} from "@capclair/contract";

export type {
  RegisterInput,
  LoginInput,
  ForgotInput,
  ResetInput,
  SessionUser as SessionUserDTO,
} from "@capclair/contract";
