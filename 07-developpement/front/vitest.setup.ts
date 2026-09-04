import { afterEach } from "vitest";

// Ce fichier s'exécute pour TOUS les tests. Les utilitaires DOM ne sont chargés
// que dans l'environnement jsdom (`.test.tsx`) — les `.test.ts` tournent sous
// `node`, sans `document`.
if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => {
    cleanup();
  });
}
