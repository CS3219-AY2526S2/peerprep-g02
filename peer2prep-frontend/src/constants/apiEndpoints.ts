export const API_ENDPOINTS = {
    USERS: {
        ME: "/users/me", // GET (info), DELETE (account)
        ADMIN_LIST: "/users/admin/users", // GET all users
        UPDATE_ROLE: (clerkId: string) => `/users/admin/users/${clerkId}/role`, // PATCH
        UPDATE_STATUS: (clerkId: string) => `/users/admin/users/${clerkId}/status`, // PATCH
    },

    QUESTIONS: {
        BASE: "http://localhost:3005/v1/api/questions", // GET (all), POST (create), PUT (edit), DELETE (delete)
        POPULAR: "http://localhost:3005/v1/api/questions/popular", // GET
        GET_ONE: "http://localhost:3005/v1/api/questions/get", // POST with {quid}
        LEETCODE: "http://localhost:3005/v1/api/questions/leetcode",
        SEARCH_DATABASE: "http://localhost:3005/v1/api/questions/search-database",
    },

    TOPICS: {
        BASE: "http://localhost:3005/v1/api/topics", // GET (all), POST (create), PUT (edit)
    }
};
