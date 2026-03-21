import type { Socket } from "socket.io-client";

import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import type { CollaborationJoinAck } from "@/models/collaboration/collaborationSocketType";
import { COLLABORATION_SOCKET_EVENTS } from "@/models/collaboration/collaborationSocketType";
import { createAuthenticatedSocket } from "@/utils/socketClient";

class CollaborationService {
    private socket: Socket | null = null;

    async connect(): Promise<Socket> {
        if (this.socket?.connected) {
            return this.socket;
        }

        if (this.socket) {
            return this.socket;
        }

        this.socket = await createAuthenticatedSocket(API_ENDPOINTS.COLLABORATION.SOCKET_PATH);
        return this.socket;
    }

    joinSession(collaborationId: string): Promise<CollaborationJoinAck> {
        return new Promise(async (resolve) => {
            const socket = await this.connect();
            socket.emit(COLLABORATION_SOCKET_EVENTS.SESSION_JOIN, { collaborationId }, resolve);
        });
    }

    disconnect(): void {
        this.socket?.disconnect();
        this.socket = null;
    }
}

export const collaborationService = new CollaborationService();
