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

export class ClerkService {
    async getUserByClerkUserId(clerkUserId: string): Promise<ClerkUserSummary> {
        const rawUser = (await clerkClient.users.getUser(clerkUserId)) as RawClerkUser;
        return normalizeClerkUser(rawUser);
    }

    async deleteUserByClerkUserId(clerkUserId: string): Promise<void> {
        await clerkClient.users.deleteUser(clerkUserId);
    }
}
