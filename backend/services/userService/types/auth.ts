export type AuthResponse = {
    message: string;
    data?: Record<string, unknown>;
};

export type ClerkUserSummary = {
    clerkUserId: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    preferredLanguage: string | null;
    lastSignInAt: Date | null;
};
