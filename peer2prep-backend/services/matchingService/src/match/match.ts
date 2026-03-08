import { ATTEMPT_REJOIN_LUA_SCRIPT, CANCEL_MATCH_LUA_SCRIPT, DISCONNECT_LUA_SCRIPT, FIND_MATCH_LUA_SCRIPT } from "@/luaScripts/matchmaking.js";
import RedisManager from "@/managers/redisManager.js";
import { type MatchRequest, type MatchResult } from "@/types/match.js";
import { buildQueueKey, buildUserStatusKey } from "@/utils/match.js";
import { v4 as uuidv4 } from "uuid";

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
        return {
            matchFound: true,
            matchId: uuidv4(),
            matchedTopic: req.topic,
            matchedDifficulty: req.difficulty,
            matchedLanguage,
            userId: req.userId,
            partnerId,
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
    })) as [string]

    return status === "success";
}

export async function handleDisconnect(userId: string) {
    const redis = RedisManager.getInstance();
    const seekerKey = buildUserStatusKey(userId);

    const [status] = (await redis.eval(DISCONNECT_LUA_SCRIPT, {
        keys: [seekerKey],
        arguments: [Date.now().toString()],
    })) as [string]

    return status === "ok";
}

export async function cancelMatch(userId: string) {
    const redis = RedisManager.getInstance();
    const seekerKey = buildUserStatusKey(userId);

    const [status] = (await redis.eval(CANCEL_MATCH_LUA_SCRIPT, {
        keys: [seekerKey],
    })) as [string]

    return status === "ok";
}