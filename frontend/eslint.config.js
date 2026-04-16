import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import prettierPlugin from "eslint-plugin-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
    {
        ignores: ["dist", "coverage", "src/components/ui/**/*", "src/lib/**/*"],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{js,jsx,ts,tsx}"],
        plugins: {
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
            "simple-import-sort": simpleImportSort,
            "unused-imports": unusedImports,
            import: importPlugin,
            prettier: prettierPlugin,
        },
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2021,
                ...globals.vitest,
            },
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

            "no-var": "error",
            "prefer-const": "error",
            "no-console": "warn",
            "no-debugger": "error",

            "import/first": "error",
            "import/newline-after-import": "error",
            "import/no-duplicates": "error",
            "import/no-unresolved": "off",

            "simple-import-sort/exports": "error",
            "simple-import-sort/imports": [
                "error",
                {
                    groups: [
                        ["^react", "^@react"],
                        ["^@?\\w"],
                        ["^@/components"],
                        ["^@/constants", "^@/lib", "^@/utils", "^@/models", "^@/hooks"],
                        ["^@/views"],
                        ["^\\.\\."],
                        ["^\\u0000"],
                    ],
                },
            ],

            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "unused-imports/no-unused-imports": "error",
            "unused-imports/no-unused-vars": [
                "warn",
                {
                    vars: "all",
                    varsIgnorePattern: "^_",
                    args: "after-used",
                    argsIgnorePattern: "^_",
                },
            ],

            "prettier/prettier": ["error", {}, { usePrettierrc: true }],
        },
    },
    eslintConfigPrettier,
);
