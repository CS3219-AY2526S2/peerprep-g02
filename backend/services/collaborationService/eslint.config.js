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
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/no-explicit-any": "warn",
        },
    },
];
