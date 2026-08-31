import type { SessionUser } from "../../server/auth/session.js";
import type { SessionUserDTO } from "./auth.dto.js";

/** Projette l'utilisateur interne vers le DTO exposé (aucune donnée sensible). */
export function toSessionUserDTO(user: SessionUser): SessionUserDTO {
  return { id: user.id, email: user.email, name: user.name };
}

/**
 * ADR-004 : le schéma n'a pas de champ `acceptedAt` ; `ConsentLog.createdAt`
 * (immuable) fait foi. Ce helper l'expose sous le nom attendu par l'API.
 */
export function consentAcceptedAt(consent: { createdAt: Date }): string {
  return consent.createdAt.toISOString();
}
