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
    primaryEmailAddressId?: string | null;
    emailAddresses?: RawClerkEmailAddress[];
};

//
function normalizeClerkUser(rawUser: RawClerkUser): ClerkUserSummary {
    const primaryEmailId = rawUser.primaryEmailAddressId;
    const primaryEmail = (rawUser.emailAddresses || []).find(
        (entry) => entry.id === primaryEmailId,
    );

    const email = primaryEmail?.emailAddress || rawUser.emailAddresses?.[0]?.emailAddress || "";
    const fullName = `${rawUser.firstName || ""} ${rawUser.lastName || ""}`.trim();
    const name = fullName || rawUser.username || email;

    if (!rawUser.id || !email) {
        throw new Error("Invalid Clerk user payload.");
    }

    return {
        clerkUserId: rawUser.id,
        email,
        name,
    };
}

export class ClerkService {
    async getUserByClerkUserId(clerkUserId: string): Promise<ClerkUserSummary> {
        const rawUser = (await clerkClient.users.getUser(clerkUserId)) as RawClerkUser;
        return normalizeClerkUser(rawUser);
    }
}
