import { v4 as uuidv4 } from "uuid";

import {
    ATTEMPT_REJOIN_LUA_SCRIPT,
    CANCEL_MATCH_LUA_SCRIPT,
    DISCONNECT_LUA_SCRIPT,
    FIND_MATCH_LUA_SCRIPT,
} from "@/luaScripts/matchmaking.js";
import RedisManager from "@/managers/redisManager.js";
import { type Difficulty, type MatchRequest, type MatchResult, type RejoinResult } from "@/types/match.js";
import { buildQueueKey, buildUserStatusKey } from "@/utils/match.js";

export async function findMatch(req: MatchRequest): Promise<MatchResult> {
    const redis = RedisManager.getInstance();

    const queueKeys = req.difficulties.flatMap((diff) =>
        req.languages.map((lang) => buildQueueKey(req.topic, diff, lang))
    );
    const seekerKey = buildUserStatusKey(req.userId);

    // run atomic matchmaking logic using a Lua script
    const [status, partnerId, matchedDifficulty, matchedLanguage, startTimeStr] = (await redis.eval(FIND_MATCH_LUA_SCRIPT, {
        keys: [...queueKeys, seekerKey],
        arguments: [Date.now().toString(), queueKeys.length.toString(), JSON.stringify(queueKeys)],
    })) as [string, string, string, string, string];

    if (status === "matched") {
        return {
            matchFound: true,
            matchId: uuidv4(),
            matchedTopic: req.topic,
            matchedDifficulty: matchedDifficulty as Difficulty,
            matchedLanguage,
            userId: req.userId,
            partnerId,
        };
    }

    return { matchFound: false, startTime: parseInt(startTimeStr, 10) };
}

export async function attemptRejoin(userId: string): Promise<RejoinResult> {
    const redis = RedisManager.getInstance();
    const seekerKey = buildUserStatusKey(userId);

    const [status, startTime] = (await redis.eval(ATTEMPT_REJOIN_LUA_SCRIPT, {
        keys: [seekerKey],
        arguments: [Date.now().toString()],
    })) as [string, string | undefined];

    return {
        success: status === "success",
        startTime: startTime ? parseInt(startTime) : undefined
    };
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
