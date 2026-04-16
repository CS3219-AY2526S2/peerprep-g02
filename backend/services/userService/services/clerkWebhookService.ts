import type { WebhookEvent } from "@clerk/express/webhooks";
import { AppConstants } from "@/constants.js";
import { userRepository } from "@/models/User.js";

type WebhookUserEmail = {
    id?: string;
    email_address?: string;
};

type WebhookUserPayload = {
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    image_url?: string | null;
    primary_email_address_id?: string | null;
    email_addresses?: WebhookUserEmail[];
    unsafe_metadata?: Record<string, unknown> | null;
};

function buildName(payload: WebhookUserPayload): string {
    const fullName = `${payload.first_name || ""} ${payload.last_name || ""}`.trim();
    if (fullName) {
        return fullName;
    }

    if (payload.username) {
        return payload.username;
    }

    const primaryEmailId = payload.primary_email_address_id;
    const primaryEmail = (payload.email_addresses || []).find(
        (entry) => entry.id === primaryEmailId,
    );
    const fallbackEmail =
        primaryEmail?.email_address || payload.email_addresses?.[0]?.email_address;
    return fallbackEmail || "User";
}

function toPreferredLanguage(payload: WebhookUserPayload): string | null {
    const value = payload.unsafe_metadata?.defaultLanguage;
    return typeof value === "string" && value.trim().length > 0
        ? value
        : AppConstants.DEFAULT_PREFERRED_LANGUAGE;
}

// process + write to DB
export class ClerkWebhookService {
    async process(event: WebhookEvent): Promise<void> {
        switch (event.type) {
            case "user.created":
            case "user.updated": {
                const payload = event.data as WebhookUserPayload;
                if (!payload.id) {
                    return;
                }

                // preferredLanguage = unsafe_metadata in Clerk
                const upsertInput: {
                    clerkUserId: string;
                    name: string;
                    avatarUrl?: string | null;
                    preferredLanguage?: string | null;
                } = {
                    clerkUserId: payload.id,
                    name: buildName(payload),
                };

                if ("image_url" in payload) {
                    upsertInput.avatarUrl = payload.image_url ?? null;
                }

                if (event.type === "user.created") {
                    upsertInput.preferredLanguage = toPreferredLanguage(payload);
                } else if ("unsafe_metadata" in payload) {
                    upsertInput.preferredLanguage = toPreferredLanguage(payload);
                }

                await userRepository.upsertFromClerk(upsertInput);
                return;
            }

            case "user.deleted": {
                const payload = event.data as { id?: string };
                if (!payload.id) {
                    return;
                }

                await userRepository.markDeletedByClerkUserId(payload.id);
                return;
            }

            default:
                return;
        }
    }
}
