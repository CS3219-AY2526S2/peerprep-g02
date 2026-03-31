import { Router } from "express";

import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/config/constants.js";
import { requireInternalAuth } from "@/middleware/internalServiceAuth.js";
import { executeCode, type TestCase } from "@/services/executionService.js";
import { logger } from "@/utils/logger.js";

const router = Router();

router.use(requireInternalAuth);

type ExecuteRequestBody = {
    code?: string;
    language?: string;
    functionName?: string;
    testCases?: TestCase[];
};

router.post("/", async (req, res) => {
    const body = req.body as ExecuteRequestBody | undefined;

    if (typeof body?.code !== "string" || body.code.trim().length === 0) {
        return res.status(400).json({ error: "code is required." });
    }

    if (
        typeof body?.language !== "string" ||
        !SUPPORTED_LANGUAGES.includes(body.language as SupportedLanguage)
    ) {
        return res.status(400).json({
            error: `language must be one of: ${SUPPORTED_LANGUAGES.join(", ")}`,
        });
    }

    if (typeof body?.functionName !== "string" || body.functionName.trim().length === 0) {
        return res.status(400).json({ error: "functionName is required." });
    }

    if (!Array.isArray(body?.testCases) || body.testCases.length === 0) {
        return res.status(400).json({ error: "testCases must be a non-empty array." });
    }

    try {
        logger.info(
            {
                language: body.language,
                functionName: body.functionName,
                testCaseCount: body.testCases.length,
            },
            "Starting code execution",
        );

        const result = await executeCode(
            body.code,
            body.language as SupportedLanguage,
            body.functionName,
            body.testCases,
        );

        logger.info(
            {
                language: body.language,
                testCasesPassed: result.testCasesPassed,
                totalTestCases: result.totalTestCases,
            },
            "Code execution completed",
        );

        return res.status(200).json(result);
    } catch (error) {
        logger.error({ err: error }, "Code execution failed");
        return res.status(500).json({ error: "Code execution failed." });
    }
});

export default router;
