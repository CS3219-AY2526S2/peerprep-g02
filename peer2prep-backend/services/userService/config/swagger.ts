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
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description: "Clerk session JWT in Authorization header as Bearer <token>.",
                },
            },
        },
        security: [{ clerkAuth: [] }],
    },
    apis: ["./controllers/**/*.ts"],
};
