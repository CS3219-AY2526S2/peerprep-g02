import type {
    SessionParticipantStatus,
    SessionParticipantStatuses,
} from "@/models/model.js";
import { SESSION_PARTICIPANT_STATUS } from "@/models/model.js";
import { getRedisClient } from "@/utils/redis.js";
import { redisLogger } from "@/utils/logger.js";

type SessionStateMap = Map<string, SessionParticipantStatus>;
type SocketCountMap = Map<string, number>;

type PresenceChangeResult = {
    allowed: boolean;
    participantCount: number;
    statusChanged: boolean;
    status: SessionParticipantStatus;
};

const sessionTtlSeconds = Number(process.env.CS_SESSION_TTL_SECONDS ?? "7200");
const presencePrefix = "collaboration:presence";
const stateBySession = new Map<string, SessionStateMap>();
const socketCountsBySession = new Map<string, SocketCountMap>();

function buildPresenceKey(sessionId: string): string {
    return `${presencePrefix}:${sessionId}`;
}

function getSessionState(sessionId: string): SessionStateMap {
    const existing = stateBySession.get(sessionId);
    if (existing) {
        return existing;
    }

    const created = new Map<string, SessionParticipantStatus>();
    stateBySession.set(sessionId, created);
    return created;
}

function getSocketCounts(sessionId: string): SocketCountMap {
    const existing = socketCountsBySession.get(sessionId);
    if (existing) {
        return existing;
    }

    const created = new Map<string, number>();
    socketCountsBySession.set(sessionId, created);
    return created;
}

function getConnectedParticipantCount(sessionId: string): number {
    const socketCounts = socketCountsBySession.get(sessionId);
    if (!socketCounts) {
        return 0;
    }

    return [...socketCounts.values()].filter((count) => count > 0).length;
}

async function persistStatus(
    sessionId: string,
    userId: string,
    status: SessionParticipantStatus,
): Promise<void> {
    const redis = getRedisClient();
    if (!redis) {
        return;
    }

    try {
        const key = buildPresenceKey(sessionId);
        await redis.hSet(key, userId, status);
        await redis.expire(key, sessionTtlSeconds);
    } catch (error) {
        redisLogger.warn({ err: error, sessionId, userId, status }, "Failed to persist participant status");
    }
}

class SessionPresenceService {
    async markConnected(sessionId: string, userId: string): Promise<PresenceChangeResult> {
        const sessionState = getSessionState(sessionId);
        const socketCounts = getSocketCounts(sessionId);
        const currentCount = socketCounts.get(userId) ?? 0;
        const connectedParticipants = getConnectedParticipantCount(sessionId);

        if (currentCount === 0 && connectedParticipants >= 2) {
            return {
                allowed: false,
                participantCount: connectedParticipants,
                statusChanged: false,
                status: sessionState.get(userId) ?? SESSION_PARTICIPANT_STATUS.DISCONNECTED,
            };
        }

        socketCounts.set(userId, currentCount + 1);
        const previousStatus = sessionState.get(userId);
        sessionState.set(userId, SESSION_PARTICIPANT_STATUS.CONNECTED);
        await persistStatus(sessionId, userId, SESSION_PARTICIPANT_STATUS.CONNECTED);

        return {
            allowed: true,
            participantCount: getConnectedParticipantCount(sessionId),
            statusChanged: previousStatus !== SESSION_PARTICIPANT_STATUS.CONNECTED,
            status: SESSION_PARTICIPANT_STATUS.CONNECTED,
        };
    }

    async markDisconnected(sessionId: string, userId: string): Promise<PresenceChangeResult> {
        const sessionState = getSessionState(sessionId);
        const socketCounts = getSocketCounts(sessionId);
        const currentCount = socketCounts.get(userId) ?? 0;

        if (currentCount <= 1) {
            socketCounts.delete(userId);
            const previousStatus = sessionState.get(userId);
            sessionState.set(userId, SESSION_PARTICIPANT_STATUS.DISCONNECTED);
            await persistStatus(sessionId, userId, SESSION_PARTICIPANT_STATUS.DISCONNECTED);

            return {
                allowed: true,
                participantCount: getConnectedParticipantCount(sessionId),
                statusChanged: previousStatus !== SESSION_PARTICIPANT_STATUS.DISCONNECTED,
                status: SESSION_PARTICIPANT_STATUS.DISCONNECTED,
            };
        }

        socketCounts.set(userId, currentCount - 1);
        return {
            allowed: true,
            participantCount: getConnectedParticipantCount(sessionId),
            statusChanged: false,
            status: SESSION_PARTICIPANT_STATUS.CONNECTED,
        };
    }

    async markLeft(sessionId: string, userId: string): Promise<PresenceChangeResult> {
        const sessionState = getSessionState(sessionId);
        const socketCounts = getSocketCounts(sessionId);
        const currentCount = socketCounts.get(userId) ?? 0;

        if (currentCount <= 1) {
            socketCounts.delete(userId);
            const previousStatus = sessionState.get(userId);
            sessionState.set(userId, SESSION_PARTICIPANT_STATUS.LEFT);
            await persistStatus(sessionId, userId, SESSION_PARTICIPANT_STATUS.LEFT);

            return {
                allowed: true,
                participantCount: getConnectedParticipantCount(sessionId),
                statusChanged: previousStatus !== SESSION_PARTICIPANT_STATUS.LEFT,
                status: SESSION_PARTICIPANT_STATUS.LEFT,
            };
        }

        socketCounts.set(userId, currentCount - 1);
        return {
            allowed: true,
            participantCount: getConnectedParticipantCount(sessionId),
            statusChanged: false,
            status: SESSION_PARTICIPANT_STATUS.CONNECTED,
        };
    }

    getStatuses(sessionId: string): SessionParticipantStatuses {
        return Object.fromEntries(getSessionState(sessionId).entries());
    }

    reset(): void {
        stateBySession.clear();
        socketCountsBySession.clear();
    }
}

export const sessionPresenceService = new SessionPresenceService();
