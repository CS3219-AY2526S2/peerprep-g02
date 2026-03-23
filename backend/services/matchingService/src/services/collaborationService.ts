import { socketLogger } from "@/utils/logger.js";

type CreateSessionRequest = {
    matchId: string;
    userAId: string;
    userBId: string;
    difficulty: string;
    language: string;
    topic: string;
};

type CreateSessionResponse = {
    session: {
        collaborationId: string;
        matchId?: string;
        userAId: string;
        userBId: string;
        difficulty: string;
        language: string;
        topic: string;
        questionId: string;
        status: string;
        createdAt: string;
    };
    idempotentHit: boolean;
    cacheWriteSucceeded: boolean;
};

export async function createCollaborationSession(
    request: CreateSessionRequest,
): Promise<string | null> {
    const collaborationServiceUrl = process.env.MS_COLLABORATION_SERVICE_URL;
    const internalServiceKey = process.env.MS_INTERNAL_SERVICE_API_KEY;

    if (!collaborationServiceUrl) {
        socketLogger.error("MS_COLLABORATION_SERVICE_URL is not configured");
        return null;
    }

    if (!internalServiceKey) {
        socketLogger.error("MS_INTERNAL_SERVICE_API_KEY is not configured");
        return null;
    }

    try {
        const response = await fetch(`http://collaboration-service:3003/sessions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-internal-service-key": internalServiceKey,
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            socketLogger.error(
                { status: response.status, body: errorBody },
                "Failed to create collaboration session",
            );
            return null;
        }

        const data = (await response.json()) as CreateSessionResponse;
        socketLogger.info(
            { collaborationId: data.session.collaborationId, matchId: request.matchId },
            "Collaboration session created successfully",
        );

        return data.session.collaborationId;
    } catch (error) {
        socketLogger.error(error, "Error calling collaboration service");
        return null;
    }
}
