import type { Socket } from "socket.io-client";

import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import type { OTOperation } from "@/models/collaboration/collaborationType";
import type { CollaborationJoinAck } from "@/models/collaboration/collaborationSocketType";
import { COLLABORATION_SOCKET_EVENTS } from "@/models/collaboration/collaborationSocketType";
import { createAuthenticatedSocket } from "@/utils/socketClient";

type CodeAck = {
    ok: boolean;
    revision?: number;
    error?: string;
};

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

    getSocket(): Socket | null {
        return this.socket;
    }

    joinSession(collaborationId: string): Promise<CollaborationJoinAck> {
        return new Promise(async (resolve) => {
            const socket = await this.connect();
            socket.emit(COLLABORATION_SOCKET_EVENTS.SESSION_JOIN, { collaborationId }, resolve);
        });
    }

    leaveSession(collaborationId: string): Promise<{ ok: boolean }> {
        return new Promise(async (resolve) => {
            const socket = await this.connect();
            socket.emit(COLLABORATION_SOCKET_EVENTS.SESSION_LEAVE, { collaborationId }, resolve);
        });
    }

    sendCodeChange(
        collaborationId: string,
        revision: number,
        operations: OTOperation[]
    ): Promise<CodeAck> {
        return new Promise(async (resolve) => {
            const socket = await this.connect();
            socket.emit(
                COLLABORATION_SOCKET_EVENTS.CODE_CHANGE,
                { collaborationId, revision, operations },
                resolve
            );
        });
    }

    disconnect(): void {
        this.socket?.disconnect();
        this.socket = null;
    }
}

export const collaborationService = new CollaborationService();
