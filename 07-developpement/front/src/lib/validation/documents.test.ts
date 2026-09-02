import { describe, expect, it } from "vitest";
import { DOCUMENT_MESSAGES, MAX_UPLOAD_BYTES } from "@capclair/contract";
import { validateFile } from "./documents";

function fakeFile(name: string, type: string, size: number): File {
  const file = new File([""], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validateFile (US-2.1 — pré-validation côté client)", () => {
  it("fichier trop lourd → message exact du contrat", () => {
    const file = fakeFile("gros.pdf", "application/pdf", MAX_UPLOAD_BYTES + 1);
    expect(validateFile(file)).toBe(DOCUMENT_MESSAGES.fileTooLarge);
  });

  it("à la limite exacte → accepté", () => {
    const file = fakeFile("juste.pdf", "application/pdf", MAX_UPLOAD_BYTES);
    expect(validateFile(file)).toBeNull();
  });

  it("type inconnu ET extension inconnue → message formats acceptés", () => {
    const file = fakeFile("archive.zip", "application/zip", 1000);
    expect(validateFile(file)).toBe(DOCUMENT_MESSAGES.wrongFormat);
  });

  it("mime absent mais extension acceptée → accepté (le serveur tranche)", () => {
    const file = fakeFile("scan.jpeg", "", 1000);
    expect(validateFile(file)).toBeNull();
  });

  it("PDF, PNG, JPEG déclarés → acceptés", () => {
    expect(validateFile(fakeFile("a.pdf", "application/pdf", 10))).toBeNull();
    expect(validateFile(fakeFile("b.png", "image/png", 10))).toBeNull();
    expect(validateFile(fakeFile("c.jpg", "image/jpeg", 10))).toBeNull();
  });
});
