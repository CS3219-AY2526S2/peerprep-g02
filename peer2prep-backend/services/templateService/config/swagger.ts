export const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Peer2Prep Backend API Development",
            version: "1.0.0",
        },
        servers: [
            {
                url: "http://localhost:3000/v1/api",
            },
        ],
        components: {
            securitySchemes: {
                clerkAuth: {
                    type: "apiKey",
                    in: "header",
                    name: "Authorization",
                    description:
                        "To authorize, log in via the frontend using Clerk. Then run `await window.Clerk.session.getToken({ template: 'jwt' })` in the browser console to retrieve your JWT. Paste it here with the 'Bearer ' prefix.",
                },
            },
        },
        security: [{ clerkAuth: [] }],
    },
    apis: ["./src/controllers/**/*.ts"],
};