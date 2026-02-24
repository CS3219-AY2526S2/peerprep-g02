export type AuthResponse = {
    message: string;
    data?: Record<string, unknown>;
};

export type ClerkUserSummary = {
    clerkUserId: string;
    email: string;
    name: string;
};
