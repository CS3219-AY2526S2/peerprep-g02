import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default [
    {
        ignores: ["dist/**", "build/**", "node_modules/**", "coverage/**"]
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettierConfig,
    {
        rules: {
            "no-unused-vars": "warn",
            "@typescript-eslint/no-explicit-any": "warn",
        },
    },
];
