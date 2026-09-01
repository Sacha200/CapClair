/**
 * La couche d'accès aux données renvoie systématiquement `NotFoundError` quand
 * une ressource n'existe pas OU appartient à un autre compte. Jamais 403 :
 * l'existence même d'un dossier d'autrui ne doit pas être révélée (US-1.5 AC2).
 */
export { NotFoundError } from "../../lib/errors.js";

import { NotFoundError } from "../../lib/errors.js";

/** Renvoie `value` s'il est non nul, sinon lève `NotFoundError(resource)`. */
export function orThrowNotFound<T>(value: T | null | undefined, resource: string): T {
  if (value === null || value === undefined) {
    throw new NotFoundError(resource);
  }
  return value;
}
