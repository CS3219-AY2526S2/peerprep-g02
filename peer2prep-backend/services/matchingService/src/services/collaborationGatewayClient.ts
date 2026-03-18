import { matchingConfig } from "@/services/config.js";

type CreateSessionPayload = {
    matchId: string;
    userAId: string;
    userBId: string;
    difficulty: "Easy" | "Medium" | "Hard";
    language: string;
    topic: string;
};

type CreateSessionResponse = {
    session?: {
        sessionId?: string;
    };
};

export class CollaborationGatewayError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CollaborationGatewayError";
    }
}

export class CollaborationGatewayClient {
    async createSession(payload: CreateSessionPayload): Promise<string> {
        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            matchingConfig.dependencyTimeoutMs,
        );

        let response: Response;

        try {
            response = await fetch(
                `${matchingConfig.apiGatewayUrl}${matchingConfig.collaborationSessionPath}`,
                {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                },
            );
        } catch (error) {
            throw new CollaborationGatewayError(
                error instanceof Error
                    ? error.message
                    : "Failed to contact collaboration service.",
            );
        } finally {
            clearTimeout(timeout);
        }

        if (!response.ok) {
            throw new CollaborationGatewayError(
                `Collaboration Service returned ${response.status}.`,
            );
        }

        const result = (await response.json()) as CreateSessionResponse;
        const sessionId = result.session?.sessionId;

        if (!sessionId) {
            throw new CollaborationGatewayError(
                "Collaboration Service response did not include a session id.",
            );
        }

        return sessionId;
    }
}

export const collaborationGatewayClient = new CollaborationGatewayClient();
