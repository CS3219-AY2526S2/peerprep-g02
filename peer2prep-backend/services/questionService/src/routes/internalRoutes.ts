import { Router } from "express";
import type { UUID } from "node:crypto";

import { requireInternalAuth } from "@/middlewares/requireInternalAuth";
import { SearchQuestion } from "@/services/questionDatabase";

const router = Router();

router.use(requireInternalAuth);

router.post("/questions/internal/select", async (req, res) => {
    const { topic, difficulty, userAId, userBId } = req.body ?? {};

    if (
        typeof topic !== "string" ||
        topic.trim().length === 0 ||
        typeof difficulty !== "string" ||
        difficulty.trim().length === 0
    ) {
        return res.status(400).json({
            error: "topic and difficulty are required.",
        });
    }

    const question = await SearchQuestion(
        topic.trim(),
        difficulty.trim(),
        typeof userAId === "string" ? (userAId as UUID) : null,
        typeof userBId === "string" ? (userBId as UUID) : null,
    );

    if (!question || typeof question !== "object") {
        return res.status(404).json({
            error: "No question is available for the selected topic and difficulty.",
        });
    }

    const questionRecord = question as Record<string, unknown>;
    const questionId =
        typeof questionRecord.quid === "string" ? questionRecord.quid : undefined;

    if (!questionId) {
        return res.status(404).json({
            error: "Question selection result did not include a question identifier.",
        });
    }

    return res.status(200).json({
        data: {
            question: {
                questionId,
                title:
                    typeof questionRecord.title === "string"
                        ? questionRecord.title
                        : undefined,
                topic:
                    typeof questionRecord.topics === "string"
                        ? questionRecord.topics
                        : topic.trim(),
                difficulty:
                    typeof questionRecord.difficulty === "string"
                        ? questionRecord.difficulty
                        : difficulty.trim(),
            },
        },
    });
});

export default router;
