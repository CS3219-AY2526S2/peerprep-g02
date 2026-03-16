import { v4 as uuidv4 } from "uuid";

import {
    ATTEMPT_REJOIN_LUA_SCRIPT,
    CANCEL_MATCH_LUA_SCRIPT,
    DISCONNECT_LUA_SCRIPT,
    FIND_MATCH_LUA_SCRIPT,
} from "@/luaScripts/matchmaking.js";
import RedisManager from "@/managers/redisManager.js";
import { type MatchRequest, type MatchResult, type StoredMatchRecord } from "@/types/match.js";
import { buildQueueKey, buildUserStatusKey } from "@/utils/match.js";
import { matchLogger } from "@/utils/logger.js";

const MATCH_RECORD_PREFIX = "mm:match";
const MATCH_TTL_SECONDS = Number(process.env.MS_MATCH_TTL_SECONDS ?? "900");

function buildMatchKey(matchId: string): string {
    return `${MATCH_RECORD_PREFIX}:${matchId}`;
}

async function storeMatch(record: StoredMatchRecord): Promise<void> {
    const redis = RedisManager.getInstance();
    await redis.set(buildMatchKey(record.matchId), JSON.stringify(record), {
        EX: MATCH_TTL_SECONDS,
    });
}

export async function getStoredMatch(matchId: string): Promise<StoredMatchRecord | null> {
    const redis = RedisManager.getInstance();
    const record = await redis.get(buildMatchKey(matchId));

    if (!record) {
        return null;
    }

    try {
        return JSON.parse(record) as StoredMatchRecord;
    } catch (error) {
        matchLogger.error({ err: error, matchId }, "Failed to parse stored match record");
        return null;
    }
}

export async function findMatch(req: MatchRequest): Promise<MatchResult> {
    const redis = RedisManager.getInstance();

    const queueKeys = req.languages.map((lang) => buildQueueKey(req.topic, req.difficulty, lang));
    const seekerKey = buildUserStatusKey(req.userId);

    // run atomic matchmaking logic using a Lua script
    const [status, partnerId, matchedLanguage] = (await redis.eval(FIND_MATCH_LUA_SCRIPT, {
        keys: [...queueKeys, seekerKey],
        arguments: [Date.now().toString(), queueKeys.length.toString(), JSON.stringify(queueKeys)],
    })) as [string, string, string];

    if (status === "matched") {
        const matchRecord: StoredMatchRecord = {
            matchId: uuidv4(),
            matchedTopic: req.topic,
            matchedDifficulty: req.difficulty,
            matchedLanguage,
            userId: req.userId,
            partnerId,
            createdAt: new Date().toISOString(),
        };

        await storeMatch(matchRecord);

        return {
            matchFound: true,
            ...matchRecord,
        };
    }

    return { matchFound: false };
}

export async function attemptRejoin(userId: string): Promise<boolean> {
    const redis = RedisManager.getInstance();
    const seekerKey = buildUserStatusKey(userId);

    const [status] = (await redis.eval(ATTEMPT_REJOIN_LUA_SCRIPT, {
        keys: [seekerKey],
        arguments: [Date.now().toString()],
    })) as [string];

    return status === "success";
}

export async function handleDisconnect(userId: string) {
    const redis = RedisManager.getInstance();
    const seekerKey = buildUserStatusKey(userId);

    const [status] = (await redis.eval(DISCONNECT_LUA_SCRIPT, {
        keys: [seekerKey],
        arguments: [Date.now().toString()],
    })) as [string];

    return status === "ok";
}

export async function cancelMatch(userId: string) {
    const redis = RedisManager.getInstance();
    const seekerKey = buildUserStatusKey(userId);

    const [status] = (await redis.eval(CANCEL_MATCH_LUA_SCRIPT, {
        keys: [seekerKey],
    })) as [string];

    return status === "ok";
}
