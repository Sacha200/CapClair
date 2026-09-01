/**
 * Nettoyage d'un nom de fichier fourni par le client (multipart `filename`),
 * avant stockage dans `Document.originalName` / `CaseFile.title`.
 *
 * Le nom brut est contrôlé par l'utilisateur : jamais de chemin (traversal),
 * jamais de caractère de contrôle (CR/LF — injection d'en-tête HTTP) ni de
 * guillemet, et une longueur bornée. Une valeur vide après nettoyage retombe
 * sur un libellé non vide.
 */
const MAX_LENGTH = 120;
const FALLBACK = "Document importé";

export function safeName(rawName: string | undefined | null): string {
  if (!rawName) return FALLBACK;

  // Ne garder que le composant final : ni chemin Unix ni chemin Windows.
  const base = rawName.split(/[/\\]/).pop() ?? "";
  // Caractères de contrôle (dont CR/LF) et guillemets : jamais dans un en-tête ni en base.
  // eslint-disable-next-line no-control-regex -- suppression intentionnelle des caractères de contrôle
  const cleaned = base.replace(/[\x00-\x1f\x7f"]/g, "").trim();

  if (!cleaned) return FALLBACK;
  return cleaned.length > MAX_LENGTH ? cleaned.slice(0, MAX_LENGTH) : cleaned;
}
