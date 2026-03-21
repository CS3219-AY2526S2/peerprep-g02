import type { SessionParticipantPresence } from "@/models/session.js";

type SocketBinding = {
    collaborationId: string;
    userId: string;
};

export class SessionPresenceRepository {
    private readonly socketsBySessionUser = new Map<string, Map<string, Set<string>>>();
    private readonly socketBindings = new Map<string, SocketBinding>();

    addSocketConnection(collaborationId: string, userId: string, socketId: string): void {
        const sessionPresence = this.socketsBySessionUser.get(collaborationId) ?? new Map();
        const userSockets = sessionPresence.get(userId) ?? new Set<string>();

        userSockets.add(socketId);
        sessionPresence.set(userId, userSockets);
        this.socketsBySessionUser.set(collaborationId, sessionPresence);
        this.socketBindings.set(socketId, { collaborationId, userId });
    }

    removeSocketConnection(socketId: string): SocketBinding | null {
        const binding = this.socketBindings.get(socketId);
        if (!binding) {
            return null;
        }

        const sessionPresence = this.socketsBySessionUser.get(binding.collaborationId);
        const userSockets = sessionPresence?.get(binding.userId);

        userSockets?.delete(socketId);

        if (userSockets && userSockets.size === 0) {
            sessionPresence?.delete(binding.userId);
        }

        if (sessionPresence && sessionPresence.size === 0) {
            this.socketsBySessionUser.delete(binding.collaborationId);
        }

        this.socketBindings.delete(socketId);
        return binding;
    }

    getDistinctUserIds(collaborationId: string): Set<string> {
        return new Set(this.socketsBySessionUser.get(collaborationId)?.keys() ?? []);
    }

    getParticipants(
        collaborationId: string,
        assignedUserIds: string[],
    ): SessionParticipantPresence[] {
        const sessionPresence = this.socketsBySessionUser.get(collaborationId) ?? new Map();

        return assignedUserIds.map((userId) => {
            const connectionCount = sessionPresence.get(userId)?.size ?? 0;

            return {
                userId,
                status: connectionCount > 0 ? "online" : "offline",
                connectionCount,
            };
        });
    }
}
