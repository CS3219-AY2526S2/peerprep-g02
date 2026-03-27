import { Socket } from "socket.io-client";

import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { createAuthenticatedSocket } from "@/utils/socketClient";
import { MATCH_EVENTS, MatchDetails } from "@/models/matching/matchingDetailsType";

class MatchingService {
    private socket: Socket | null = null;

    async connect() {
        if (this.socket?.connected) return this.socket;
        this.socket = await createAuthenticatedSocket(API_ENDPOINTS.MATCHING.BASE);
        return this.socket;
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
