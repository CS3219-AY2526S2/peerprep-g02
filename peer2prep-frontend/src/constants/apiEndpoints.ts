export const API_ENDPOINTS = {
    USERS: {
        ME: "/users/me", // GET (info), DELETE (account)
        ADMIN_LIST: "/users/admin/users", // GET all users
        UPDATE_ROLE: (clerkId: string) => `/users/admin/users/${clerkId}/role`, // PATCH
        UPDATE_STATUS: (clerkId: string) => `/users/admin/users/${clerkId}/status`, // PATCH
    },
    MATCHING: {
        GATEWAY_PATH: `${import.meta.env.VITE_GATEWAY_ENDPOINT}/v1/api/matching`,
    },
    QUESTIONS: {
        BASE: "http://localhost:3005/v1/api/questions", // GET (all), POST (create), PUT (edit)
        POPULAR: "http://localhost:3005/v1/api/questions/popular", // GET
        GET_ONE: "http://localhost:3005/v1/api/questions/get", // POST with {quid}
        DELETE: "http://localhost:3005/v1/api/questions/delete", // POST with {quid}
    },
};
