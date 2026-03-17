/** Publishes internal domain events for significant collaboration-session lifecycle actions. */
import { EventEmitter } from "node:events";

import {
    CollaborationSession,
    SessionEventType,
} from "@/models/models.js";
import { logger } from "@/utils/logger.js";

class SessionEventBus extends EventEmitter {
    publishSessionCreated(session: CollaborationSession): void {
        this.emit(SessionEventType.SESSION_CREATED, session);
    }
}

export const sessionEventBus = new SessionEventBus();

sessionEventBus.on(SessionEventType.SESSION_CREATED, (session) => {
    logger.info(
        {
            sessionId: session.sessionId,
            userAId: session.userAId,
            userBId: session.userBId,
            eventType: SessionEventType.SESSION_CREATED,
        },
        "Published collaboration session created event",
    );
});
