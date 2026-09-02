/**
 * Extraction du texte d'un PDF (US-2.4) — ADR-013 / ADR-016.
 *
 * `unpdf` (wrapper ESM de PDF.js, sans effet de bord fichier) est isolé ici :
 * c'est le SEUL point de dépendance à la librairie ; un repli (`pdf-parse`)
 * ne toucherait que ce module.
 *
 * Contrat d'erreur : cette fonction ne lève JAMAIS. Tout échec (PDF corrompu,
 * chiffré, dépassement de `PDF_EXTRACT_TIMEOUT_MS`) renvoie
 * `{ text: "", pageCount: 0 }` → le service enchaîne sur le parcours
 * « document illisible » (US-2.6), pas de 500 ni de requête pendante.
 */
import { extractText, getDocumentProxy } from "unpdf";
import { env } from "../../env.js";

export interface PdfExtraction {
  text: string;
  pageCount: number;
}

const UNREADABLE: PdfExtraction = { text: "", pageCount: 0 };

async function doExtract(bytes: Buffer): Promise<PdfExtraction> {
  // Copie : pdf.js détache le buffer qu'on lui confie (transfert au worker).
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  return { text, pageCount: totalPages };
}

export async function extractPdfText(bytes: Buffer): Promise<PdfExtraction> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<PdfExtraction>((resolve) => {
    timer = setTimeout(() => resolve(UNREADABLE), env.PDF_EXTRACT_TIMEOUT_MS);
  });
  try {
    return await Promise.race([doExtract(bytes), timeout]);
  } catch {
    return UNREADABLE;
  } finally {
    clearTimeout(timer);
  }
}
