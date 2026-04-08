import { v4 as uuidv4 } from "uuid";

import {
    ATTEMPT_REJOIN_LUA_SCRIPT,
    CANCEL_MATCH_LUA_SCRIPT,
    DISCONNECT_LUA_SCRIPT,
    FIND_MATCH_LUA_SCRIPT,
} from "@/luaScripts/matchmaking.js";
import { RabbitMQManager } from "@/managers/rabbitmqManager.js";
import RedisManager from "@/managers/redisManager.js";
import {
    type Difficulty,
    type MatchRequest,
    type MatchResult,
    type RejoinResult,
} from "@/types/match.js";
import { buildQueueKey, buildUserStatusKey } from "@/utils/match.js";

export async function findMatch(req: MatchRequest): Promise<MatchResult> {
    const redis = RedisManager.getInstance();
    const rabbitMQ = RabbitMQManager.getInstance();

    const queueKeys = req.topics.flatMap((topic) =>
        req.difficulties.flatMap((diff) =>
            req.languages.map((lang) => buildQueueKey(topic, diff, lang)),
        ),
    );
    const seekerKey = buildUserStatusKey(req.userId);

    const [status, partnerId, matchedTopic, matchedDifficulty, matchedLanguage, startTimeStr] =
        (await redis.eval(FIND_MATCH_LUA_SCRIPT, {
            keys: [...queueKeys, seekerKey],
            arguments: [
                Date.now().toString(),
                queueKeys.length.toString(),
                JSON.stringify(queueKeys),
                req.userScore.toString(),
                req.scoreRange.toString(),
            ],
        })) as [string, string, string, string, string, string];

    if (status === "matched") {
        const matchId = uuidv4();

        await rabbitMQ.publishCreateSession({
            matchId,
            userAId: req.userId,
            userBId: partnerId,
            difficulty: matchedDifficulty,
            language: matchedLanguage,
            topic: matchedTopic,
        });

        return {
            matchFound: true,
            matchId,
            matchedTopic,
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
        startTime: startTime ? parseInt(startTime, 10) : undefined,
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
