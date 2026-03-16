module.exports = {
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "node",
    extensionsToTreatAsEsm: [".ts"],
    roots: ["<rootDir>/tests"],
    setupFiles: ["<rootDir>/jest.setup.cjs"],
    moduleNameMapper: {
        "^@/(.*)\\.js$": "<rootDir>/src/$1.ts",
        "^@/(.*)$": "<rootDir>/src/$1",
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    transform: {
        "^.+\\.ts$": [
            "ts-jest",
            {
                useESM: true,
                tsconfig: "<rootDir>/tsconfig.json",
            },
        ],
    },
    testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
