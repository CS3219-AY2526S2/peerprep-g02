import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    test: {
        globals: true,
        environment: "node",
        coverage: {
            provider: "v8",
            reportsDirectory: "coverage",
            include: ["src/**/*.{ts,tsx,js,jsx}"],
            exclude: ["**/*.test.{ts,tsx}", "**/node_modules/**"],
        },
    },
});