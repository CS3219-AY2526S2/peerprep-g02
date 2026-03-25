import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppConstants } from "../../constants.js";
import { requireInternalAuth } from "../../middlewares/requireInternalAuth.js";
import { createMockNext, createMockRequest, createMockResponse } from "../helpers/httpMocks.js";

describe("requireInternalAuth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when the internal service key is missing", () => {
        const req = createMockRequest({
            header: vi.fn().mockReturnValue(undefined),
        });
        const res = createMockResponse();
        const next = createMockNext();

        requireInternalAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            error: "Unauthorized internal service request.",
        });
        expect(next).not.toHaveBeenCalled();
    });

    it("calls next when the internal service key matches", () => {
        const req = createMockRequest({
            header: vi.fn().mockImplementation((name: string) =>
                name === "x-internal-service-key"
                    ? AppConstants.INTERNAL_SERVICE_API_KEY
                    : undefined,
            ),
        });
        const res = createMockResponse();
        const next = createMockNext();

        requireInternalAuth(req, res, next);

        expect(res.status).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
    });
});
