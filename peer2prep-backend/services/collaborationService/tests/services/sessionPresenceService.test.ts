import { sessionPresenceService } from "@/services/sessionPresenceService.js";

describe("sessionPresenceService", () => {
    beforeEach(() => {
        sessionPresenceService.reset();
    });

    it("tracks connected, disconnected, and left states per user", async () => {
        await expect(sessionPresenceService.markConnected("session-1", "user-a")).resolves.toMatchObject({
            allowed: true,
            status: "connected",
            statusChanged: true,
        });

        await expect(sessionPresenceService.markDisconnected("session-1", "user-a")).resolves.toMatchObject({
            allowed: true,
            status: "disconnected",
            statusChanged: true,
        });

        await expect(sessionPresenceService.markConnected("session-1", "user-a")).resolves.toMatchObject({
            allowed: true,
            status: "connected",
            statusChanged: true,
        });

        await expect(sessionPresenceService.markLeft("session-1", "user-a")).resolves.toMatchObject({
            allowed: true,
            status: "left",
            statusChanged: true,
        });

        expect(sessionPresenceService.getStatuses("session-1")).toEqual({
            "user-a": "left",
        });
    });

    it("prevents more than two distinct connected users from being present", async () => {
        await sessionPresenceService.markConnected("session-1", "user-a");
        await sessionPresenceService.markConnected("session-1", "user-b");

        await expect(sessionPresenceService.markConnected("session-1", "user-c")).resolves.toEqual({
            allowed: false,
            participantCount: 2,
            statusChanged: false,
            status: "disconnected",
        });
    });
});
