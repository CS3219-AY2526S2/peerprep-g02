import { afterEach, describe, expect, it, vi } from "vitest";
import { InternalAuthController } from "../../controllers/InternalAuthController.js";
import { userRepository } from "../../models/User.js";
import { createMockRequest, createMockResponse } from "./httpMocks.js";

vi.mock("../../models/User.js", async () => {
    const actual = await vi.importActual<typeof import("../../models/User.js")>(
        "../../models/User.js",
    );

    return {
        ...actual,
        userRepository: {
            ...actual.userRepository,
            findByClerkUserIds: vi.fn(),
        },
    };
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("InternalAuthController", () => {
    // missing clerk user context
    it("returns 500 when clerk user context is missing for context authorization", () => {
        const controller = new InternalAuthController();
        const req = createMockRequest();
        const res = createMockResponse();

        controller.authorizeContext(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: "Authenticated user context is missing.",
        });
    });

    // success case
    it("returns 200 and auth context for context authorization", () => {
        const controller = new InternalAuthController();
        const req = createMockRequest();
        const res = createMockResponse();
        res.locals.clerkUserId = "user_123";
        res.locals.authUser = {
            clerkUserId: "user_123",
            role: "user",
            status: "active",
        };

        controller.authorizeContext(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            data: {
                clerkUserId: "user_123",
                role: "user",
                status: "active",
            },
        });
    });

    it("returns 400 when batch authorization receives no userIds array", async () => {
        const controller = new InternalAuthController();
        const req = createMockRequest({ body: {} });
        const res = createMockResponse();

        await controller.authorizeContextBatch(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: "userIds must be a non-empty array.",
        });
    });

    it("returns 400 when batch authorization receives invalid userIds", async () => {
        const controller = new InternalAuthController();
        const req = createMockRequest({ body: { userIds: ["user_123", ""] } });
        const res = createMockResponse();

        await controller.authorizeContextBatch(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: "userIds must contain only non-empty strings.",
        });
    });

    it("returns 200 and batch auth context for requested users", async () => {
        vi.mocked(userRepository.findByClerkUserIds).mockResolvedValue([
            {
                clerkUserId: "user_123",
                name: "User A",
                avatarUrl: null,
                status: "active",
                role: "user",
                preferredLanguage: null,
                lastLoginAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                clerkUserId: "user_456",
                name: "User B",
                avatarUrl: null,
                status: "suspended",
                role: "admin",
                preferredLanguage: null,
                lastLoginAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);

        const controller = new InternalAuthController();
        const req = createMockRequest({ body: { userIds: ["user_123", "user_456"] } });
        const res = createMockResponse();

        await controller.authorizeContextBatch(req, res);

        expect(userRepository.findByClerkUserIds).toHaveBeenCalledWith([
            "user_123",
            "user_456",
        ]);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            data: {
                users: [
                    {
                        clerkUserId: "user_123",
                        role: "user",
                        status: "active",
                    },
                    {
                        clerkUserId: "user_456",
                        role: "admin",
                        status: "suspended",
                    },
                ],
            },
        });
    });
});
