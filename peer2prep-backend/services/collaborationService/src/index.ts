import "dotenv/config";

import app from "@/app.js";
import { collaborationConfig } from "@/services/config.js";
import { logger } from "@/utils/logger.js";

const port = collaborationConfig.port;

app.listen(port, "0.0.0.0", () => {
    logger.info(`Collaboration Service live at http://localhost:${port}`);
});
