import "dotenv/config";

import app from "@/app.js";
import { logger } from "@/utils/logger.js";

const port = Number(process.env.CS_SERVER_PORT ?? "3003");

app.listen(port, "0.0.0.0", () => {
    logger.info(`Collaboration Service live at http://localhost:${port}`);
});
