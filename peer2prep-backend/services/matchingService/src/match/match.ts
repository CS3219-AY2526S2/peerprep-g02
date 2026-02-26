import { MATCHMAKING_LUA } from "@/luaScripts/matchmaking.js";
import RedisManager from "@/managers/redisManager.js";
import { type MatchRequest, type MatchResult } from "@/types/match.js";
import { buildQueueKey, buildUserKey } from "@/utils/match.js";

export async function findMatch(req: MatchRequest): Promise<MatchResult> {
    const redis = RedisManager.getInstance();

    const queueKeys = req.languages.map((lang) => buildQueueKey(req.topic, req.difficulty, lang));
    const seekerKey = buildUserKey(req.userId);

    // run atomic matchmaking logic using a Lua script
    const [status, partnerId, matchedLanguage] = (await redis.eval(MATCHMAKING_LUA, {
        keys: [...queueKeys, seekerKey],
        arguments: [Date.now().toString(), queueKeys.length.toString(), JSON.stringify(queueKeys)],
    })) as [string, string, string];

    if (status === "matched") {
        return {
            matchFound: true,
            matchId: "0000", // todo
            matchedLanguage,
            partnerId,
        };
    }

    return { matchFound: false };
}
