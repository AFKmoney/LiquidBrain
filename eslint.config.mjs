import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/prefer-as-const": "off",

      // React rules
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/purity": "off",
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",
      "react/prop-types": "off",
      "react-compiler/react-compiler": "off",

      // Next.js rules
      "@next/next/no-img-element": "off",
      "@next/next/no-html-link-for-pages": "off",
      // lucide-react exports an `Image` component which the a11y rule would
      // otherwise treat like an <img> and demand an alt prop for.
      "jsx-a11y/alt-text": ["warn", { elements: ["img"], components: [], imgAlt: "" }],

      // General JavaScript rules
      "prefer-const": "off",
      "no-unused-vars": "off",
      "no-console": "off",
      "no-debugger": "off",
      "no-empty": "off",
      "no-irregular-whitespace": "off",
      "no-case-declarations": "off",
      "no-fallthrough": "off",
      "no-mixed-spaces-and-tabs": "off",
      "no-redeclare": "off",
      "no-undef": "off",
      "no-unreachable": "off",
      "no-useless-escape": "off",
    },
  },
  {
    // Vendored shadcn/ui primitives: kept byte-compatible with upstream so the
    // app-level React rules (and future `shadcn diff`) do not churn them.
    files: ["src/components/ui/**"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
      "jsx-a11y/alt-text": "off",
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills"],
  },
];

export default eslintConfig;
