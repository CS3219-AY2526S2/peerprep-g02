export const SUPPORTED_LANGUAGES = ["python", "javascript", "typescript", "java"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const PISTON_LANGUAGE_MAP: Record<SupportedLanguage, { language: string; version: string }> = {
    python: { language: "python", version: "3.10.0" },
    javascript: { language: "javascript", version: "*" },
    typescript: { language: "typescript", version: "*" },
    java: { language: "java", version: "*" },
};

/** Runtimes to install on Piston at startup if missing.
 *  Package names differ from execution aliases — e.g. "node" not "javascript". */
export const REQUIRED_RUNTIMES = [
    { language: "python", version: "3.10.0" },
    { language: "node", version: "18.15.0" },
    { language: "typescript", version: "5.0.3" },
    { language: "java", version: "15.0.2" },
];

export const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    INTERNAL_SERVER_ERROR: 500,
} as const;
