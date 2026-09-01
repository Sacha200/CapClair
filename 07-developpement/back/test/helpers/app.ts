import { buildApp } from "../../src/app.js";

export type TestApp = Awaited<ReturnType<typeof buildApp>>;

let app: TestApp | undefined;

export async function getApp(): Promise<TestApp> {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export async function closeApp(): Promise<void> {
  await app?.close();
  app = undefined;
}

/** Extrait la valeur du cookie de session d'une réponse `inject`. */
export function sessionCookie(res: {
  cookies: Array<{ name: string; value: string }>;
}): string | undefined {
  const c = res.cookies.find((x) => x.name === "capclair_session");
  return c ? `${c.name}=${c.value}` : undefined;
}
