import { afterEach, describe, expect, it, vi } from "vitest";

import {
    CollaborationGatewayClient,
    CollaborationGatewayError,
} from "@/services/collaborationGatewayClient.js";

describe("CollaborationGatewayClient", () => {
    const client = new CollaborationGatewayClient();

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns the collaboration session id on success", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    session: {
                        sessionId: "session-123",
                    },
                }),
            }),
        );

        await expect(
            client.createSession({
                matchId: "match-1",
                userAId: "user-a",
                userBId: "user-b",
                difficulty: "Easy",
                language: "JavaScript",
                topic: "Arrays",
            }),
        ).resolves.toBe("session-123");
    });

    it("throws when the collaboration service responds without a session id", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    session: {},
                }),
            }),
        );

        await expect(
            client.createSession({
                matchId: "match-1",
                userAId: "user-a",
                userBId: "user-b",
                difficulty: "Easy",
                language: "JavaScript",
                topic: "Arrays",
            }),
        ).rejects.toBeInstanceOf(CollaborationGatewayError);
    });

    it("throws when the collaboration service returns a non-success status", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                status: 424,
            }),
        );

        await expect(
            client.createSession({
                matchId: "match-1",
                userAId: "user-a",
                userBId: "user-b",
                difficulty: "Easy",
                language: "JavaScript",
                topic: "Arrays",
            }),
        ).rejects.toBeInstanceOf(CollaborationGatewayError);
    });
});
