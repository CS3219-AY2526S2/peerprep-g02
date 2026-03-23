import { clerkClient } from "@clerk/express";

import { ClerkUserSummary } from "../types/auth.js";

type RawClerkEmailAddress = {
    id?: string;
    emailAddress?: string;
};

type RawClerkUser = {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    imageUrl?: string | null;
    lastSignInAt?: Date | number | string | null;
    unsafeMetadata?: Record<string, unknown> | null;
    primaryEmailAddressId?: string | null;
    emailAddresses?: RawClerkEmailAddress[];
};

type RawClerkSession = {
    id?: string;
};

function toDate(value: Date | number | string | null | undefined): Date | null {
    if (value === null || value === undefined) {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    const normalized = new Date(value);
    return Number.isNaN(normalized.getTime()) ? null : normalized;
}

function normalizeClerkUser(rawUser: RawClerkUser): ClerkUserSummary {
    const primaryEmailId = rawUser.primaryEmailAddressId;
    const primaryEmail = (rawUser.emailAddresses || []).find(
        (entry) => entry.id === primaryEmailId,
    );

    const email = primaryEmail?.emailAddress || rawUser.emailAddresses?.[0]?.emailAddress || "";
    const fullName = `${rawUser.firstName || ""} ${rawUser.lastName || ""}`.trim();
    const name = fullName || rawUser.username || email;
    const avatarUrl = typeof rawUser.imageUrl === "string" ? rawUser.imageUrl : null;
    const preferredLanguageValue = rawUser.unsafeMetadata?.defaultLanguage;
    const preferredLanguage =
        typeof preferredLanguageValue === "string" ? preferredLanguageValue : null;
    const lastSignInAt = toDate(rawUser.lastSignInAt);

    if (!rawUser.id || !email) {
        throw new Error("Invalid Clerk user payload.");
    }

    return {
        clerkUserId: rawUser.id,
        email,
        name,
        avatarUrl,
        preferredLanguage,
        lastSignInAt,
    };
}

function chunkIds(ids: string[], chunkSize: number): string[][] {
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
        chunks.push(ids.slice(i, i + chunkSize));
    }
    return chunks;
}

export class ClerkService {
    async getUserByClerkUserId(clerkUserId: string): Promise<ClerkUserSummary> {
        const rawUser = (await clerkClient.users.getUser(clerkUserId)) as RawClerkUser;
        return normalizeClerkUser(rawUser);
    }

    async deleteUserByClerkUserId(clerkUserId: string): Promise<void> {
        await clerkClient.users.deleteUser(clerkUserId);
    }

    async banUserByClerkUserId(clerkUserId: string): Promise<void> {
        await clerkClient.users.banUser(clerkUserId);
    }

    async unbanUserByClerkUserId(clerkUserId: string): Promise<void> {
        await clerkClient.users.unbanUser(clerkUserId);
    }

    async revokeActiveSessionsByClerkUserId(clerkUserId: string): Promise<void> {
        const response = await clerkClient.sessions.getSessionList({
            userId: clerkUserId,
            status: "active",
        });
        const sessions = Array.isArray(response) ? response : response.data;

        for (const session of sessions as RawClerkSession[]) {
            if (session.id) {
                await clerkClient.sessions.revokeSession(session.id);
            }
        }
    }

    async getUsersByClerkUserIds(clerkUserIds: string[]): Promise<Map<string, ClerkUserSummary>> {
        const results = new Map<string, ClerkUserSummary>();
        if (clerkUserIds.length === 0) {
            return results;
        }

        const uniqueIds = [...new Set(clerkUserIds)];
        const idChunks = chunkIds(uniqueIds, 100);

        for (const ids of idChunks) {
            const response = await clerkClient.users.getUserList({
                userId: ids,
                limit: ids.length,
            });
            const users = Array.isArray(response) ? response : response.data;

            for (const rawUser of users as RawClerkUser[]) {
                try {
                    const normalized = normalizeClerkUser(rawUser);
                    results.set(normalized.clerkUserId, normalized);
                } catch {
                    // Ignore invalid Clerk payload entries.
                }
            }
        }

        return results;
    }
}
