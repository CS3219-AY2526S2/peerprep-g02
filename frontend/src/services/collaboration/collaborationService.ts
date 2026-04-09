import type { Socket } from "socket.io-client";

import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { createAuthenticatedSocket } from "@/utils/socketClient";
import type { CollaborationJoinAck } from "@/models/collaboration/collaborationSocketType";
import { COLLABORATION_SOCKET_EVENTS } from "@/models/collaboration/collaborationSocketType";
import type { OTOperation } from "@/models/collaboration/collaborationType";

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

    async joinSession(collaborationId: string): Promise<CollaborationJoinAck> {
        const socket = await this.connect();
        return new Promise((resolve) => {
            socket.emit(COLLABORATION_SOCKET_EVENTS.SESSION_JOIN, { collaborationId }, resolve);
        });
    }

    async leaveSession(collaborationId: string): Promise<{ ok: boolean }> {
        const socket = await this.connect();
        return new Promise((resolve) => {
            socket.emit(COLLABORATION_SOCKET_EVENTS.SESSION_LEAVE, { collaborationId }, resolve);
        });
    }

    async sendCodeChange(
        collaborationId: string,
        revision: number,
        operations: OTOperation[],
    ): Promise<CodeAck> {
        const socket = await this.connect();
        return new Promise((resolve) => {
            socket.emit(
                COLLABORATION_SOCKET_EVENTS.CODE_CHANGE,
                { collaborationId, revision, operations },
                resolve,
            );
        });
    }

    async runCode(collaborationId: string): Promise<{ ok: boolean; error?: string }> {
        const socket = await this.connect();
        return new Promise((resolve) => {
            socket.emit(
                COLLABORATION_SOCKET_EVENTS.CODE_RUN,
                { collaborationId },
                (response: { ok: boolean; error?: string }) => {
                    resolve(response);
                },
            );
        });
    }

    async submitCode(collaborationId: string): Promise<{ ok: boolean; error?: string }> {
        const socket = await this.connect();
        return new Promise((resolve) => {
            socket.emit(
                COLLABORATION_SOCKET_EVENTS.CODE_SUBMIT,
                { collaborationId },
                (response: { ok: boolean; error?: string }) => {
                    resolve(response);
                },
            );
        });
    }

    async checkActiveSession(): Promise<{
        collaborationId: string;
        topic: string;
        difficulty: string;
    } | null> {
        // Use a dedicated socket so we don't interfere with the shared singleton
        let dedicatedSocket: Socket | null = null;
        try {
            dedicatedSocket = await createAuthenticatedSocket(
                API_ENDPOINTS.COLLABORATION.SOCKET_PATH,
            );

            return await new Promise<{
                collaborationId: string;
                topic: string;
                difficulty: string;
            } | null>((resolve) => {
                const timeout = setTimeout(() => {
                    dedicatedSocket?.disconnect();
                    resolve(null);
                }, 5000);

                dedicatedSocket!.emit(
                    COLLABORATION_SOCKET_EVENTS.SESSION_CHECK_ACTIVE,
                    {},
                    (response: {
                        ok: boolean;
                        activeSession?: {
                            collaborationId: string;
                            topic: string;
                            difficulty: string;
                        } | null;
                    }) => {
                        clearTimeout(timeout);
                        dedicatedSocket?.disconnect();
                        if (response.ok && response.activeSession) {
                            resolve(response.activeSession);
                        } else {
                            resolve(null);
                        }
                    },
                );
            });
        } catch {
            dedicatedSocket?.disconnect();
            return null;
        }
    }

    disconnect(): void {
        this.socket?.disconnect();
        this.socket = null;
    }
}

export const collaborationService = new CollaborationService();
