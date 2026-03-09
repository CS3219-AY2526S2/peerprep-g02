// import { getAuth } from "@clerk/express";
import { Request, Response } from "express";

/** Helper method to extract `userId` */
// export function getUserId(req: Request): string | null {
//     const { userId } = getAuth(req);
//     return userId || null;
// }

/** Centralized error handling */
export function handleError(res: Response, error: unknown, action: string): void {
    console.error(`Error ${action}:`, error);
    if (error instanceof Error) {
        res.status(500).json({ error: error.message });
    } else {
        res.status(500).json({ error: `Unknown error occurred while ${action}.` });
    }
}

/** 🔹 Standardized 401 Unauthorized response */
export function unauthorized(res: Response): void {
    res.status(401).json({ error: "Unauthorized access. Please log in." });
}

/** 🔹 Standardized 400 Bad Request response */
export function badRequest(res: Response, message: string): void {
    res.status(400).json({ error: message });
}
