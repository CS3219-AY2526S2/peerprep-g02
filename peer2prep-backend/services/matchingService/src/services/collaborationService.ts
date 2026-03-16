import type { MatchResultSuccess } from "@/types/match.js";
import { mainLogger } from "@/utils/logger.js";

type CollaborationSessionResponse = {
    session?: {
        sessionId: string;
        questionId: string;
        status: string;
        createdAt: string;
        userAId: string;
        userBId: string;
        difficulty: string;
        language: string;
        topic: string;
    };
    idempotentHit?: boolean;
};

const collaborationServiceBaseUrl =
    process.env.MS_COLLABORATION_SERVICE_URL ?? "http://collaboration-service:3004";
const internalServiceApiKey = process.env.INTERNAL_SERVICE_API_KEY ?? "";

export async function createCollaborationSession(match: MatchResultSuccess): Promise<void> {
    const response = await fetch(
        `${collaborationServiceBaseUrl}/v1/api/collaboration/internal/sessions`,
        {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-internal-service-key": internalServiceApiKey,
            },
            body: JSON.stringify({
                userAId: match.userId,
                userBId: match.partnerId,
                difficulty: match.matchedDifficulty,
                language: match.matchedLanguage,
                topic: match.matchedTopic,
            }),
        },
    );

    if (!response.ok) {
        const errorBody = (await response.text().catch(() => "")) || "Unknown error";
        throw new Error(
            `Collaboration service returned ${response.status} during session creation: ${errorBody}`,
        );
    }

    const payload = (await response.json()) as CollaborationSessionResponse;
    mainLogger.info(
        {
            matchId: match.matchId,
            sessionId: payload.session?.sessionId,
            questionId: payload.session?.questionId,
            idempotentHit: payload.idempotentHit ?? false,
        },
        "Collaboration session created for match",
    );
}
