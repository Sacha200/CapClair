/**
 * Appels API de l'import de documents (E2). Toutes les routes sont sous le
 * scope gardé `/api/*` : le cookie de session part automatiquement (même
 * origine via le rewrite `/api/back/*`).
 */
import { DOCUMENT_PATHS, type UploadDocumentResponse } from "@capclair/contract";
import { BROWSER_API_BASE } from "@/lib/config";
import { apiRequest } from "./client";

function toFormData(file: File): FormData {
  const form = new FormData();
  form.append("file", file);
  return form;
}

export function uploadDocument(file: File): Promise<UploadDocumentResponse> {
  return apiRequest(DOCUMENT_PATHS.UPLOAD, { method: "POST", body: toFormData(file) });
}

/** Même document, même dossier : transition « illisible → lisible » (US-2.6 AC4). */
export function replaceDocument(id: string, file: File): Promise<UploadDocumentResponse> {
  return apiRequest(DOCUMENT_PATHS.replace(id), { method: "POST", body: toFormData(file) });
}

export function deleteDocument(id: string): Promise<void> {
  return apiRequest(DOCUMENT_PATHS.detail(id), { method: "DELETE" });
}

export function confirmFictional(id: string): Promise<{ ok: true }> {
  return apiRequest(DOCUMENT_PATHS.confirmFictional(id), {
    method: "POST",
    body: { confirmed: true },
  });
}

/** `src` d'aperçu (iframe/img) — authentifié par le cookie first-party (US-2.2 AC1/AC3). */
export function documentFileSrc(id: string): string {
  return `${BROWSER_API_BASE}${DOCUMENT_PATHS.file(id)}`;
}
