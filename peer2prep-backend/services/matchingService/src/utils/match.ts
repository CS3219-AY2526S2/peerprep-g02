import { QUEUE_PREFIX, USER_PREFIX, MATCH_PREFIX, type Difficulty } from "@/types/match.js";

export function buildQueueKey(topic: string, difficulty: Difficulty, language: string) {
    return `${QUEUE_PREFIX}:${topic}:${difficulty}:${language}`;
}

export function buildUserKey(userId: string) {
    return `${USER_PREFIX}:${userId}`;
}

export function buildMatchKey(matchId: string) {
    return `${MATCH_PREFIX}:${matchId}`;
}