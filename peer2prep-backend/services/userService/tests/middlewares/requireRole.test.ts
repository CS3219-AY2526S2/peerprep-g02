import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAuth } from "../../middlewares/requireAuth.js";
import { requireRole } from "../../middlewares/requireRole.js";

vi.mock("../../middlewares/requireAuth.js", () => ({
    requireAuth: vi.fn(),
}));

describe("requireRole", () => {
    const requireAuthMock = vi.mocked(requireAuth);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // admin role check delegation
    it("delegates admin role checks to requireAuth with requiredRole options", () => {
        const delegatedMiddleware = vi.fn(async () => undefined) as ReturnType<typeof requireAuth>;
        requireAuthMock.mockReturnValue(delegatedMiddleware);

        const middleware = requireRole("admin");

        expect(requireAuthMock).toHaveBeenCalledWith({
            requiredRole: "admin",
        });
        expect(middleware).toBe(delegatedMiddleware);
    });
});
