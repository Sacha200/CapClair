/** Primitives cryptographiques bas niveau (jetons, empreintes, comparaison constante). */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Jeton aléatoire opaque, encodé en base64url (par défaut 32 octets = 256 bits). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Empreinte SHA-256 hexadécimale. Utilisée pour stocker jetons de session et de reset. */
export function sha256hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Comparaison à temps constant de deux chaînes hexadécimales de même longueur. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
