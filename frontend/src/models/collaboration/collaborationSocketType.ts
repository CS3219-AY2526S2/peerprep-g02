export const COLLABORATION_SOCKET_EVENTS = {
    // Socket.IO built-in events
    CONNECT: "connect",
    DISCONNECT: "disconnect",
    CONNECT_ERROR: "connect_error",

    // Connection events
    CONNECTION_READY: "connection:ready",

    // Session events
    SESSION_JOIN: "session:join",
    SESSION_LEAVE: "session:leave",
    SESSION_ENDED: "session:ended",

    // Presence events
    PRESENCE_UPDATED: "presence:updated",
    USER_JOINED: "user:joined",
    USER_DISCONNECTED: "user:disconnected",
    USER_LEFT: "user:left",

    // Code editor events (OT-based)
    CODE_CHANGE: "code:change",
    CODE_ACK: "code:ack",
    CODE_SYNC: "code:sync",

    // Output events
    OUTPUT_UPDATED: "output:updated",

    // Code execution events
    CODE_RUN: "code:run",
    CODE_SUBMIT: "code:submit",
    CODE_RUNNING: "code:running",
    SUBMISSION_COMPLETE: "submission:complete",
} as const;

export type CollaborationJoinAck =
    | {
          ok: true;
          state: import("./collaborationType").CollaborationJoinState;
      }
    | {
          ok: false;
          error: string;
          message: string;
      };

export type CodeAck = {
    ok: boolean;
    revision?: number;
    error?: string;
};
