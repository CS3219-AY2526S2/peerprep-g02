import { env } from "@/config/env.js";
import { logger } from "@/utils/logger.js";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export type HintContext = {
    questionTitle: string;
    questionDescription: string;
    difficulty: string;
    language: string;
    currentCode: string;
    previousHints: string[];
};

export class AiHintService {
    async generateHint(context: HintContext): Promise<string> {
        if (!env.geminiApiKey) {
            logger.error("Gemini API key is not configured (CS_GEMINI_API_KEY is empty)");
            throw new Error("Gemini API key is not configured");
        }

        logger.info(
            { questionTitle: context.questionTitle, language: context.language },
            "Generating AI hint via Gemini",
        );

        const previousHintsText =
            context.previousHints.length > 0
                ? `\n\nPrevious hints already given (do NOT repeat these):\n${context.previousHints.map((h, i) => `${i + 1}. ${h}`).join("\n")}`
                : "";

        const hasCode = context.currentCode.trim().length > 0;

        const prompt = `You are a coding tutor for a LeetCode-style challenge. Your job is to give a SPECIFIC, ACTIONABLE hint that moves the students closer to a correct solution. Do NOT give the full solution or write complete code.

Problem: ${context.questionTitle}
Difficulty: ${context.difficulty}
Language: ${context.language}

Problem Description:
${context.questionDescription}

Their Current Code:
\`\`\`${context.language}
${context.currentCode || "// No code written yet"}
\`\`\`
${previousHintsText}

INSTRUCTIONS:
${
    hasCode
        ? `- Carefully analyze their code. If there is a bug, missing step, or logical error, point it out specifically (e.g. "You're missing the step that moves the left pointer inward after a swap").
- If their approach is wrong, suggest the correct algorithm/technique by name (e.g. "Try using two pointers from both ends") without writing the code.
- Reference specific parts of their code when relevant (e.g. "Your while loop condition should check..." or "After line where you do X, you need to also...").`
        : `- Suggest the key algorithm, technique, or data structure to solve this problem (e.g. "Use two pointers", "Think about using a hash map to track...").
- Explain briefly WHY that approach works for this problem.`
}
- Keep it to 2-3 sentences. Be direct and specific, not vague.
- Do NOT say generic things like "review your logic" or "think about edge cases". Point out the EXACT issue or next step.`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);

        try {
            const response = await fetch(`${GEMINI_URL}?key=${env.geminiApiKey}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        maxOutputTokens: 512,
                        temperature: 0.4,
                    },
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorBody = await response.text().catch(() => "");
                logger.error(
                    { statusCode: response.status, errorBody },
                    "Gemini API request failed",
                );
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const data = (await response.json()) as {
                candidates?: Array<{
                    content?: { parts?: Array<{ text?: string }> };
                }>;
            };

            const hint = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!hint) {
                logger.error({ data }, "Gemini returned an empty or malformed response");
                throw new Error("Gemini returned an empty response");
            }

            logger.info("AI hint generated successfully");
            return hint;
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                logger.error("Gemini API request timed out after 15s");
                throw new Error("Gemini API request timed out", { cause: error });
            }
            logger.error({ err: error }, "Gemini API hint generation failed");
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }
}
