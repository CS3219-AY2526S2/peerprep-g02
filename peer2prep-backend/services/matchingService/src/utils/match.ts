import { type Difficulty, USER_STATUS_PREFIX, QUEUE_PREFIX } from "@/types/match.js";

export function buildQueueKey(topic: string, difficulty: Difficulty, language: string) {
    return `${QUEUE_PREFIX}:${topic}:${difficulty}:${language}`;
}

export function buildUserStatusKey(userId: string) {
    return `${USER_STATUS_PREFIX}:${userId}`;
}