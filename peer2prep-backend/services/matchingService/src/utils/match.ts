import { type Difficulty, QUEUE_PREFIX, USER_PREFIX } from "@/types/match.js";

export function buildQueueKey(topic: string, difficulty: Difficulty, language: string) {
    return `${QUEUE_PREFIX}:${topic}:${difficulty}:${language}`;
}

export function buildUserKey(userId: string) {
    return `${USER_PREFIX}:${userId}`;
}
