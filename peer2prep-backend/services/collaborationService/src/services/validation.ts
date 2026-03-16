import { z } from "zod";

import type { CreateSessionRequest } from "@/models/model.js";

const createSessionSchema = z
    .object({
        userAId: z.string().trim().min(1, "userAId is required."),
        userBId: z.string().trim().min(1, "userBId is required."),
        difficulty: z.enum(["Easy", "Medium", "Hard"], {
            error: () => ({ message: "difficulty must be one of Easy, Medium, or Hard." }),
        }),
        language: z.string().trim().min(1, "language is required."),
        topic: z.string().trim().min(1, "topic is required."),
    })
    .refine((value) => value.userAId !== value.userBId, {
        message: "userAId and userBId must be different users.",
        path: ["userBId"],
    });

type CreateSessionValidationResult =
    | { valid: true; value: CreateSessionRequest }
    | { valid: false; error: string };

export function validateCreateSessionPayload(
    payload: unknown,
): CreateSessionValidationResult {
    const result = createSessionSchema.safeParse(payload);

    if (!result.success) {
        const issue = result.error.issues[0];
        return {
            valid: false,
            error: issue?.message ?? "Invalid session creation request.",
        };
    }

    return {
        valid: true,
        value: result.data,
    };
}
