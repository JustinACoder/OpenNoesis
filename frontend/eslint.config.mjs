import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  ...compat.extends("prettier"),
  // Turn off "unused eslint-disable" warnings in generated / model files
  {
    // This configuration object will only apply to TypeScript files
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // Disable the rule for explicit `any` usage
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["src/lib/models/**/*.{ts,tsx}"],
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]
  }
];

export default eslintConfig;
