import {
  AUTH_PATHS,
  type AuthOkResponse,
  type ForgotInput,
  type ForgotResponse,
  type LoginInput,
  type RegisterInput,
  type ResetInput,
  type SessionResponse,
} from "@capclair/contract";
import { apiRequest } from "./client";

export function register(input: RegisterInput): Promise<AuthOkResponse> {
  return apiRequest(AUTH_PATHS.REGISTER, { method: "POST", body: input });
}

export function login(input: LoginInput): Promise<AuthOkResponse> {
  return apiRequest(AUTH_PATHS.LOGIN, { method: "POST", body: input });
}

export function logout(): Promise<void> {
  return apiRequest(AUTH_PATHS.LOGOUT, { method: "POST" });
}

export function forgotPassword(input: ForgotInput): Promise<ForgotResponse> {
  return apiRequest(AUTH_PATHS.FORGOT, { method: "POST", body: input });
}

export function resetPassword(input: ResetInput): Promise<AuthOkResponse> {
  return apiRequest(AUTH_PATHS.RESET, { method: "POST", body: input });
}

/** Côté serveur uniquement : lit la session courante en transmettant le cookie. */
export function getSessionWithCookie(cookieHeader: string): Promise<SessionResponse> {
  return apiRequest(AUTH_PATHS.SESSION, { cookieHeader });
}
