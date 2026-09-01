/**
 * Aide à l'upload multipart pour les tests d'intégration (US-2.1).
 *
 * Convention rate-limit (ADR-009) : le store `import` n'est pas remis à zéro
 * entre tests (app mémoïsée, `getApp()`). Donner une `remoteAddress` distincte
 * par fichier de test évite qu'un test consomme le quota d'un autre ; réserver
 * une IP dédiée au fichier `documents.ratelimit.test.ts`.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { TestApp } from "./app.js";

type InjectResponse = Awaited<ReturnType<TestApp["inject"]>>;

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/", import.meta.url));

export function readFixture(name: string): Buffer {
  return readFileSync(`${FIXTURES_DIR}${name}`);
}

function buildMultipartBody(
  bytes: Buffer,
  filename: string,
  contentType: string,
): { body: Buffer; boundary: string } {
  const boundary = `capclairTestBoundary${Math.random().toString(16).slice(2)}`;
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { body: Buffer.concat([head, bytes, tail]), boundary };
}

export interface UploadOptions {
  filename?: string;
  contentType?: string;
  remoteAddress?: string;
  /** Sans cookie : la requête n'est pas authentifiée (test 401). */
  cookie?: string;
}

export function uploadBytes(
  app: TestApp,
  bytes: Buffer,
  options: UploadOptions = {},
): Promise<InjectResponse> {
  const { body, boundary } = buildMultipartBody(
    bytes,
    options.filename ?? "courrier.pdf",
    options.contentType ?? "application/pdf",
  );
  return app.inject({
    method: "POST",
    url: "/api/documents",
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload: body,
    remoteAddress: options.remoteAddress,
  });
}

export function uploadFixture(
  app: TestApp,
  fixtureName: string,
  options: UploadOptions = {},
): Promise<InjectResponse> {
  return uploadBytes(app, readFixture(fixtureName), options);
}
