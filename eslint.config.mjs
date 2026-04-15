import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Deno/Node server files — not part of Next.js build
    "supabase/**",
    "server.js",
    "node_modules/**",
    // Database migrations and scripts
    "database/**",
    "apps-script/**",
  ]),
]);

export default eslintConfig;
