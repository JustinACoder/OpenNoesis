import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    // This configuration object will only apply to TypeScript files
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // Disable the rule for explicit `any` usage
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
