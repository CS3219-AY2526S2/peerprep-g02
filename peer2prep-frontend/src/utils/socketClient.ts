import { io, Socket } from "socket.io-client";
import { getAuthToken } from "@/utils/apiClient";

/**
 * Creates an authenticated Socket.io instance routed through the API Gateway.
 * @param path The Gateway path (e.g., /v1/api/matching) defined in Nginx.
 */
export async function createAuthenticatedSocket(fullUrl: string): Promise<Socket> {
    const token = await getAuthToken();

    const url = new URL(fullUrl);
    const baseUrl = `${url.protocol}//${url.host}`;
    const customPath = url.pathname;

    const socket = io(baseUrl, {
        path: `${customPath}/socket.io/`,
        auth: {
            token: token
        },
    });
    
    return socket;
}