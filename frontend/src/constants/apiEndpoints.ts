const gatewayBase = (() => {
    const raw = import.meta.env.VITE_GATEWAY_ENDPOINT as string | undefined;
    if (!raw) {
        throw new Error("VITE_GATEWAY_ENDPOINT is not defined");
    }
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
})();

const US_PREFIX = `${gatewayBase}/us`;
const MS_PREFIX = `${gatewayBase}/ms`;
const QS_PREFIX = `${gatewayBase}/qs`;
const CS_PREFIX = `${gatewayBase}/cs`;
const AS_PREFIX = `${gatewayBase}/as`;

export const API_ENDPOINTS = {
    USERS: {
        ME: `${US_PREFIX}/users/me`,
        ADMIN_LIST: `${US_PREFIX}/users/admin/users`,
        UPDATE_ROLE: (clerkId: string) => `${US_PREFIX}/users/admin/users/${clerkId}/role`,
        UPDATE_STATUS: (clerkId: string) => `${US_PREFIX}/users/admin/users/${clerkId}/status`,
        SCORE: (clerkId: string) => `${US_PREFIX}/users/internal/${clerkId}/score`,
    },

    MATCHING: {
        BASE: `${MS_PREFIX}`,
    },

    QUESTIONS: {
        BASE: `${QS_PREFIX}/`,
        POPULAR: `${QS_PREFIX}/popular`,
        GET_ONE: `${QS_PREFIX}/get`,
        LEETCODE: `${QS_PREFIX}/leetcode`,
        SEARCH_DATABASE: `${QS_PREFIX}/search-database`,
        TOPICS: `${QS_PREFIX}/topics`,
        IMAGE: `${QS_PREFIX}/image-upload`
    },

    COLLABORATION: {
        SOCKET_PATH: `${CS_PREFIX}/sessions`,
    },

    ATTEMPTS: {
        HISTORY: `${AS_PREFIX}/attempts/me`,
    },
} as const;
