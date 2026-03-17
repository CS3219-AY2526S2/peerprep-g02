import "dotenv/config";

import { collaborationConfig } from "@/services/config.js";
import { createRealtimeServer } from "@/services/socketServer.js";
import { logger } from "@/utils/logger.js";

const port = collaborationConfig.port;
const { httpServer } = createRealtimeServer();

httpServer.listen(port, "0.0.0.0", () => {
    logger.info(`Collaboration Service live at http://localhost:${port}`);
});
