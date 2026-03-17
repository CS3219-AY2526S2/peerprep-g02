export enum ParticipantPresenceStatus {
    CONNECTED = "connected",
    DISCONNECTED = "disconnected",
    LEFT = "left",
}

export enum SessionSocketEventName {
    SESSION_JOIN = "session:join",
    SESSION_LEAVE = "session:leave",
    SESSION_JOINED = "session:joined",
    SESSION_PEER_JOINED = "session:peer-joined",
    SESSION_PEER_DISCONNECTED = "session:peer-disconnected",
    SESSION_PEER_LEFT = "session:peer-left",
    SESSION_ERROR = "session:error",
}

export enum ActivityTone {
    PEER = "peer",
    YOU = "you",
    SYSTEM = "system",
}

export type ParticipantPresence = {
    userId: string;
    status: ParticipantPresenceStatus;
};

export type CollaborationSessionDto = {
    sessionId: string;
    userAId: string;
    userBId: string;
    difficulty: string;
    language: string;
    topic: string;
    questionId: string;
    status: string;
    createdAt: string;
};

export type SessionJoinResponse = {
    session: CollaborationSessionDto;
    currentUserId: string;
    participants: ParticipantPresence[];
};

export type SessionPeerPresenceEvent = {
    userId: string;
    participants: ParticipantPresence[];
};

export type SessionErrorEvent = {
    message?: string;
};

export type ActivityMessage = {
    id: string;
    author: string;
    text: string;
    tone: ActivityTone;
};
