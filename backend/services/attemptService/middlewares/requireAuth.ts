import type { NextFunction, Request, Response } from "express";

import { AppConstants } from "@/constants.js";
import { logger } from "@/utils/logger.js";

type InternalAuthContextResponse = {
  data?: {
    clerkUserId?: string;
    role?: string;
    status?: string;
  };
  error?: string;
};

const INTERNAL_AUTHZ_URL = `${AppConstants.USER_SERVICE_URL}/users/internal/authz/context`;

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = req.header("authorization");

  if (!authorization) {
    res.status(401).json({ error: "Unauthorized: missing bearer token." });
    return;
  }

  if (!AppConstants.INTERNAL_SERVICE_API_KEY) {
    res.status(500).json({ error: "Internal auth is not configured." });
    return;
  }

  try {
    const response = await fetch(INTERNAL_AUTHZ_URL, {
      headers: {
        authorization,
        "x-internal-service-key": AppConstants.INTERNAL_SERVICE_API_KEY,
      },
    });

    const payload = (await response
      .json()
      .catch(() => null)) as InternalAuthContextResponse | null;

    if (!response.ok) {
      res
        .status(response.status)
        .json(payload ?? { error: "Failed to authorize user." });
      return;
    }

    if (payload?.data?.status !== "active" || !payload.data.clerkUserId) {
      res.status(403).json({ error: "Forbidden: account is not active." });
      return;
    }

    res.locals.authContext = payload.data;
    res.locals.clerkUserId = payload.data.clerkUserId;
    next();
  } catch (error) {
    logger.error({ err: error }, "Failed to authorize attempt service request");
    res.status(500).json({ error: "Failed to authorize user." });
  }
}
