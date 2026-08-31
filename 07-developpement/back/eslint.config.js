// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "src/generated/**",
      "coverage/**",
      "node_modules/**",
      "eslint.config.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Fastify : les plugins et handlers sont `async` par contrat de signature,
      // même sans `await` dans le corps.
      "@typescript-eslint/require-await": "off",
      "no-console": ["warn", { allow: ["error", "warn"] }],
    },
  },
  {
    // Interdit d'appeler Prisma directement hors de la couche d'accès aux données.
    // Toute lecture/écriture sur les entités métier doit passer par server/database
    // (context.forUser / repositories) — isolation userId, US-1.5.
    // `server/auth/*` est exempté : il gère l'infra d'auth (User, Session,
    // VerificationToken), pas les entités métier scopées par dossier.
    files: ["src/features/**/*.ts", "src/worker/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='prisma'] > Identifier.property[name=/^(findUnique|findFirst|findMany|create|createMany|update|updateMany|upsert|delete|deleteMany)$/]",
          message:
            "Accès Prisma direct interdit ici. Passer par server/database (context.forUser / repositories) — isolation userId, US-1.5.",
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-restricted-syntax": "off",
    },
  },
  prettier,
);
