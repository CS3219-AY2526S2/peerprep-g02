import { beforeEach, describe, expect, it } from "vitest";
import type { Request } from "express";
import { AppConstants } from "../../constants.js";
import { requireInternalAuth } from "../../middlewares/requireInternalAuth.js";
import { createMockNext, createMockRequest, createMockResponse } from "../helpers/httpMocks.js";

function mockHeader(resolver: (name: string) => string | undefined): Request["header"] {
    return ((name: string) => resolver(name)) as Request["header"];
}

describe("requireInternalAuth", () => {
    beforeEach(() => {
        AppConstants.INTERNAL_SERVICE_API_KEY = "test-internal-key";
    });

    it("returns 401 when internal service key is missing", () => {
        const req = createMockRequest({
            header: mockHeader(() => undefined),
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

    it("returns 401 when internal service key is invalid", () => {
        const req = createMockRequest({
            header: mockHeader(() => "invalid-key"),
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

    it("calls next when internal service key is valid", () => {
        const req = createMockRequest({
            header: mockHeader((name: string) =>
                name === "x-internal-service-key" ? "test-internal-key" : undefined,
            ),
        });
        const res = createMockResponse();
        const next = createMockNext();

        requireInternalAuth(req, res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });
});
