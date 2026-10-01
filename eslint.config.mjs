import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/components/about-dialog.tsx", "src/components/image-transfer.tsx", "src/components/workspace-preview.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
  {
    files: ["src/hooks/use-platform.ts", "src/hooks/use-theme.ts"],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/vendor/**",
  ]),
]);

export default eslintConfig;
