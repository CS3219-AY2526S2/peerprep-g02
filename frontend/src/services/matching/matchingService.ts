import { Socket } from "socket.io-client";

import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { createAuthenticatedSocket } from "@/utils/socketClient";
import { MATCH_EVENTS, MatchDetails } from "@/models/matching/matchingDetailsType";

class MatchingService {
    private socket: Socket | null = null;
    private connectingPromise: Promise<Socket> | null = null;

    async connect() {
        if (this.socket?.connected) return this.socket;
        if (this.connectingPromise) return this.connectingPromise;

        this.connectingPromise = createAuthenticatedSocket(API_ENDPOINTS.MATCHING.BASE)
            .then((socket) => {
                this.socket = socket;

                return new Promise<Socket>((resolve, reject) => {
                    if (socket.connected) {
                        this.connectingPromise = null;
                        resolve(socket);
                    } else {
                        socket.once("connect", () => {
                            this.connectingPromise = null;
                            resolve(socket);
                        });
                        socket.once("connect_error", (err) => {
                            this.connectingPromise = null;
                            reject(err);
                        });
                    }
                });
            })
            .catch((err) => {
                this.connectingPromise = null;
                throw err;
            });

        return this.connectingPromise;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    joinQueue(data: MatchDetails) {
        if (!this.socket) return;
        this.socket.emit(MATCH_EVENTS.JOIN_QUEUE, data);
    }

    cancelQueue() {
        this.socket?.emit(MATCH_EVENTS.CANCEL_QUEUE);
    }
}

export const matchingService = new MatchingService();

// FOR DEMO
// if (typeof window !== "undefined") {
//     (window as any).matchingService = matchingService;
// }
