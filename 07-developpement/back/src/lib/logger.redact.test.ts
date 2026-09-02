/**
 * US-8.2 / décision #14 (plan E2) — la configuration `redact` du logger doit
 * caviarder le nom de fichier d'origine et le texte extrait d'un courrier,
 * à la racine comme imbriqués. Le logger applicatif est silencieux en test :
 * on rejoue la MÊME configuration sur une instance pino dédiée avec un flux
 * de capture, puis on vérifie la sortie brute.
 */
import { Writable } from "node:stream";
import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { redactPaths } from "./logger.js";

function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(String(chunk));
      cb();
    },
  });
  const logger = pino({ redact: { paths: redactPaths, censor: "[redacted]" } }, stream);
  return { logger, output: () => lines.join("") };
}

describe("redact pino — contenu de documents (US-8.2)", () => {
  it("originalName / extractedText / filename ne sortent jamais en clair", () => {
    const { logger, output } = captureLogger();

    logger.info(
      {
        documentId: "doc-1",
        originalName: "attestation-caf-secrete.pdf",
        extractedText: "Montant du RSA : 607,75 euros",
        filename: "upload-nadia.pdf",
      },
      "import",
    );
    logger.info({
      document: {
        originalName: "imbrique.pdf",
        extractedText: "Référence allocataire 0847213C",
      },
    });

    const out = output();
    expect(out).not.toContain("attestation-caf-secrete");
    expect(out).not.toContain("607,75");
    expect(out).not.toContain("upload-nadia");
    expect(out).not.toContain("imbrique.pdf");
    expect(out).not.toContain("0847213C");
    expect(out).toContain("[redacted]");
  });

  it("les champs loggables de la convention documents restent visibles", () => {
    const { logger, output } = captureLogger();
    logger.info({
      documentId: "doc-2",
      caseFileId: "case-2",
      kind: "pdf",
      sizeBytes: 3344,
      pageCount: 1,
      readable: true,
      extractedTextLength: 330,
    });
    const out = output();
    expect(out).toContain("doc-2");
    expect(out).toContain("3344");
    expect(out).toContain("extractedTextLength");
  });
});
