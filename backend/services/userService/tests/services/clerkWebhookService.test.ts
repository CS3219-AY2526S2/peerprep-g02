import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebhookEvent } from "@clerk/express/webhooks";
import { userRepository } from "../../models/User.js";
import { ClerkWebhookService } from "../../services/clerkWebhookService.js";

describe("ClerkWebhookService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // user.updated
    it("upserts user profile fields for user.updated events", async () => {
        const upsertSpy = vi.spyOn(userRepository, "upsertFromClerk").mockResolvedValue({
            clerkUserId: "user_123",
            name: "Alice Tan",
            avatarUrl: "https://cdn.example.com/alice.png",
            status: "active",
            role: "user",
            score: 0,
            preferredLanguage: "Python",
            lastLoginAt: new Date("2026-02-20T00:00:00.000Z"),
            createdAt: new Date("2026-02-20T00:00:00.000Z"),
            updatedAt: new Date("2026-02-20T00:00:00.000Z"),
        });

        const service = new ClerkWebhookService();
        const event = {
            type: "user.updated",
            object: "event",
            data: {
                id: "user_123",
                first_name: "Alice",
                last_name: "Tan",
                image_url: "https://cdn.example.com/alice.png",
                unsafe_metadata: { defaultLanguage: "Python" },
            },
            event_attributes: { http_request: { client_ip: "127.0.0.1", user_agent: "test" } },
        } as unknown as WebhookEvent;

        await service.process(event);

        expect(upsertSpy).toHaveBeenCalledWith({
            clerkUserId: "user_123",
            name: "Alice Tan",
            avatarUrl: "https://cdn.example.com/alice.png",
            preferredLanguage: "Python",
        });
    });

    // user.created
    it("upserts user profile fields for user.created events", async () => {
        const upsertSpy = vi.spyOn(userRepository, "upsertFromClerk").mockResolvedValue({
            clerkUserId: "user_234",
            name: "new_user",
            avatarUrl: null,
            status: "active",
            role: "user",
            score: 0,
            preferredLanguage: "Java",
            lastLoginAt: null,
            createdAt: new Date("2026-02-20T00:00:00.000Z"),
            updatedAt: new Date("2026-02-20T00:00:00.000Z"),
        });

        const service = new ClerkWebhookService();
        const event = {
            type: "user.created",
            object: "event",
            data: {
                id: "user_234",
                username: "new_user",
                unsafe_metadata: { defaultLanguage: "Java" },
            },
            event_attributes: { http_request: { client_ip: "127.0.0.1", user_agent: "test" } },
        } as unknown as WebhookEvent;

        await service.process(event);

        expect(upsertSpy).toHaveBeenCalledWith({
            clerkUserId: "user_234",
            name: "new_user",
            preferredLanguage: "Java",
        });
    });

    it("does not overwrite avatar or preferredLanguage when fields are missing in payload", async () => {
        const upsertSpy = vi.spyOn(userRepository, "upsertFromClerk").mockResolvedValue({
            clerkUserId: "user_345",
            name: "Alice",
            avatarUrl: "https://cdn.example.com/alice.png",
            status: "active",
            role: "user",
            score: 0,
            preferredLanguage: "Python",
            lastLoginAt: null,
            createdAt: new Date("2026-02-20T00:00:00.000Z"),
            updatedAt: new Date("2026-02-20T00:00:00.000Z"),
        });

        const service = new ClerkWebhookService();
        const event = {
            type: "user.updated",
            object: "event",
            data: {
                id: "user_345",
                first_name: "Alice",
            },
            event_attributes: { http_request: { client_ip: "127.0.0.1", user_agent: "test" } },
        } as unknown as WebhookEvent;

        await service.process(event);

        expect(upsertSpy).toHaveBeenCalledWith({
            clerkUserId: "user_345",
            name: "Alice",
        });
    });

    // user.deleted
    it("marks user as deleted for user.deleted events", async () => {
        const markDeletedSpy = vi
            .spyOn(userRepository, "markDeletedByClerkUserId")
            .mockResolvedValue(undefined);

        const service = new ClerkWebhookService();
        const event = {
            type: "user.deleted",
            object: "event",
            data: { id: "user_123" },
            event_attributes: { http_request: { client_ip: "127.0.0.1", user_agent: "test" } },
        } as unknown as WebhookEvent;

        await service.process(event);

        expect(markDeletedSpy).toHaveBeenCalledWith("user_123");
    });

    it("ignores unsupported events", async () => {
        const upsertSpy = vi.spyOn(userRepository, "upsertFromClerk");
        const markDeletedSpy = vi.spyOn(userRepository, "markDeletedByClerkUserId");

        const service = new ClerkWebhookService();
        const event = {
            type: "session.created",
            object: "event",
            data: {},
            event_attributes: { http_request: { client_ip: "127.0.0.1", user_agent: "test" } },
        } as unknown as WebhookEvent;

        await service.process(event);

        expect(upsertSpy).not.toHaveBeenCalled();
        expect(markDeletedSpy).not.toHaveBeenCalled();
    });
});
