import { io, Socket } from "socket.io-client";
import { getAuthToken } from "@/utils/apiClient";

export async function createAuthenticatedSocket(fullUrl: string): Promise<Socket> {
    const token = await getAuthToken();

    const url = new URL(fullUrl);
    const baseUrl = `${url.protocol}//${url.host}`;
    const customPath = url.pathname;

    const socket = io(baseUrl, {
        path: `${customPath}/socket.io/`,
        auth: {
            token: token,
        },
    });

    return socket;
}
