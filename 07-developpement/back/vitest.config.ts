import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/generated/**", "src/**/*.test.ts", "src/index.ts", "src/worker/index.ts"],
    },
  },
});
