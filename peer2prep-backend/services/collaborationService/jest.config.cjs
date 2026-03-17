/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "node",
    extensionsToTreatAsEsm: [".ts"],
    moduleNameMapper: {
        "^@/(.*)\\.js$": "<rootDir>/src/$1.ts",
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    transform: {
        "^.+\\.ts$": [
            "ts-jest",
            {
                useESM: true,
                tsconfig: {
                    isolatedModules: true,
                },
            },
        ],
    },
    testMatch: ["<rootDir>/tests/**/*.test.ts"],
    testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
