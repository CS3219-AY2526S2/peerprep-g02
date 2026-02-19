export const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "PeerPrep User Service API",
            version: "1.0.0",
        },
        servers: [
            {
                url: "http://localhost:3001/v1/api/users",
            },
        ],
        components: {
            securitySchemes: {
                clerkAuth: {
                    type: "apiKey",
                    in: "header",
                    name: "Authorization",
                    description: "Bearer token from Clerk session.",
                },
            },
        },
        security: [{ clerkAuth: [] }],
    },
    apis: ["./controllers/**/*.ts"],
};
