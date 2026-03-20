import "dotenv/config";

import { NextFunction, Request, Response } from "express";

type InternalAuthContextResponse = {
    data?: {
        clerkUserId?: string;
        role?: string;
        status?: string;
    };
    error?: string;
};

const INTERNAL_AUTHZ_URL =
    process.env.USER_SERVICE_INTERNAL_AUTHZ_URL ??
    "http://user-service:3001/v1/api/users/internal/authz/context";

export async function requireAdminAuth(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    const authorization = req.header("authorization");
    const internalServiceApiKey = process.env.INTERNAL_SERVICE_API_KEY;

    if (!authorization) {
        res.status(401).json({ error: "Unauthorized: missing bearer token." });
        return;
    }

    if (!internalServiceApiKey) {
        res.status(500).json({ error: "Internal auth is not configured." });
        return;
    }

    try {
        console.log("[questionService] calling internal authz context endpoint", {
            url: INTERNAL_AUTHZ_URL,
        });

        const response = await fetch(INTERNAL_AUTHZ_URL, {
            headers: {
                authorization,
                "x-internal-service-key": internalServiceApiKey,
            },
        });

        const payload = (await response
            .json()
            .catch(() => null)) as InternalAuthContextResponse | null;

        console.log("[questionService] internal authz response", {
            ok: response.ok,
            statusCode: response.status,
            role: payload?.data?.role,
            accountStatus: payload?.data?.status,
            clerkUserId: payload?.data?.clerkUserId,
            method: req.method,
            path: req.originalUrl,
            hasAuthorization: Boolean(authorization),
            error: payload?.error,
        });

        console.log(response);
        if (!response.ok) {
            res.status(response.status).json(payload ?? { error: "Failed to authorize user." });
            return;
        }

        if (payload?.data?.status !== "active") {
            res.status(403).json({ error: "Forbidden: account is not active." });
            return;
        }

        if (payload?.data?.role !== "admin" && payload?.data?.role !== "super_user") {
            res.status(403).json({ error: "Forbidden: admin role required." });
            return;
        }

        res.locals.authContext = payload.data;
        next();
    } catch (error) {
        console.error("Failed to authorize question service request:", error);
        res.status(500).json({ error: "Failed to authorize user." });
    }
}
