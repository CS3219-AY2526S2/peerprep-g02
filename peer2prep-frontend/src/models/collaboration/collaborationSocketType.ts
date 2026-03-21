export const COLLABORATION_SOCKET_EVENTS = {
    CONNECT: "connect",
    DISCONNECT: "disconnect",
    CONNECTION_READY: "connection:ready",
    SESSION_JOIN: "session:join",
    PRESENCE_UPDATED: "presence:updated",
    CONNECT_ERROR: "connect_error",
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
