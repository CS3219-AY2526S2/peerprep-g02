export const ROUTES = {
    LOGIN: "/account/login",
    REGISTER: "/account/register",

    DASHBOARD: "/home",
    ATTEMPT_HISTORY: "/attempt/history",
    COLLABORATION: "/collaboration/:collaborationId",

    USER_ADMIN: "/account/admin",
    QUESTION_ADMIN: "/question-admin",

    MATCHING: "/match",
};

export function collaborationRoute(collaborationId: string): string {
    return `/collaboration/${collaborationId}`;
}
