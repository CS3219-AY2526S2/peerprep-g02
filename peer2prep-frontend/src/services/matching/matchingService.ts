import { Socket } from "socket.io-client";
import { createAuthenticatedSocket } from "@/utils/socketClient";
import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { MatchDetails, MATCH_EVENTS } from "@/models/matching/matchingType";

class MatchingService {
    private socket: Socket | null = null;

    async connect() {
        if (this.socket?.connected) return this.socket;
        this.socket = await createAuthenticatedSocket(API_ENDPOINTS.MATCHING.GATEWAY_PATH);
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
