import type { SessionDifficulty } from "@/models/model.js";
import { logger } from "@/utils/logger.js";

export type MatchRecord = {
    matchId: string;
    userId: string;
    partnerId: string;
    matchedTopic: string;
    matchedDifficulty: SessionDifficulty;
    matchedLanguage: string;
    createdAt: string;
};

type MatchLookupResponse = {
    data?: MatchRecord;
};

const matchingServiceBaseUrl =
    process.env.CS_MATCHING_SERVICE_URL ?? "http://matching-service:5002";
const internalServiceApiKey = process.env.INTERNAL_SERVICE_API_KEY ?? "";

export type VerifyMatchResult =
    | { valid: true; match: MatchRecord }
    | { valid: false; errorType: "MATCH_NOT_FOUND" }
    | { valid: false; errorType: "SERVICE_DEPENDENCY_ERROR"; message: string };

export async function verifyMatch(matchId: string): Promise<VerifyMatchResult> {
    try {
        const response = await fetch(
            `${matchingServiceBaseUrl}/v1/api/matching/internal/matches/${encodeURIComponent(matchId)}`,
            {
                method: "GET",
                headers: {
                    "x-internal-service-key": internalServiceApiKey,
                },
            },
        );

        if (response.status === 404) {
            return { valid: false, errorType: "MATCH_NOT_FOUND" };
        }

        if (!response.ok) {
            logger.error(
                { matchId, statusCode: response.status },
                "Matching service lookup failed due to error response",
            );
            return {
                valid: false,
                errorType: "SERVICE_DEPENDENCY_ERROR",
                message: `Matching service returned ${response.status}.`,
            };
        }

        const payload = (await response.json()) as MatchLookupResponse;
        if (!payload.data?.matchId) {
            return {
                valid: false,
                errorType: "SERVICE_DEPENDENCY_ERROR",
                message: "Matching service returned an invalid response.",
            };
        }

        return {
            valid: true,
            match: payload.data,
        };
    } catch (error) {
        logger.error({ err: error, matchId }, "Matching service lookup failed due to dependency error");
        return {
            valid: false,
            errorType: "SERVICE_DEPENDENCY_ERROR",
            message: error instanceof Error ? error.message : "Unknown dependency error.",
        };
    }
}
