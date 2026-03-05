export type CreateSessionPayload = {
    userAId: string;
    userBId: string;
    difficulty: string;
    language: string;
};

export type CollaborationSession = {
    sessionId: string;
    userAId: string;
    userBId: string;
    difficulty: string;
    language: string;
    status: "active" | "inactive";
    createdAt: string;
};

type SessionResponse = {
    session: CollaborationSession;
    idempotentHit: boolean;
};

const getCollaborationBaseUrl = (): string => {
    const explicit = import.meta.env.VITE_COLLAB_SERVICE_URL as string | undefined;
    if (explicit && explicit.trim().length > 0) {
        return explicit;
    }

    const backendHost = import.meta.env.VITE_BACKEND_HOST as string | undefined;
    if (backendHost && backendHost.trim().length > 0) {
        return backendHost.replace(/\/$/, "").replace(/:\d+$/, ":3003");
    }

    return "http://localhost:3003";
};

export async function createSession(
    payload: CreateSessionPayload,
): Promise<SessionResponse> {
    const response = await fetch(`${getCollaborationBaseUrl()}/v1/api/sessions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Session creation failed (${response.status}): ${text}`);
    }

    return (await response.json()) as SessionResponse;
}

export function createSessionStub(payload: CreateSessionPayload): SessionResponse {
    return {
        session: {
            sessionId: `stub-${payload.userAId}-${payload.userBId}`,
            userAId: payload.userAId,
            userBId: payload.userBId,
            difficulty: payload.difficulty,
            language: payload.language,
            status: "active",
            createdAt: new Date().toISOString(),
        },
        idempotentHit: false,
    };
}
