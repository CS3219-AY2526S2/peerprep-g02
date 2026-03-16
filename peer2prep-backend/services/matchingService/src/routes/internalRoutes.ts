import { Router } from "express";

import { requireInternalAuth } from "@/middlewares/requireInternalAuth.js";
import { getStoredMatch } from "@/match/match.js";

const router = Router();

router.use(requireInternalAuth);

router.get("/matches/:matchId", async (req, res) => {
    const match = await getStoredMatch(req.params.matchId);

    if (!match) {
        return res.status(404).json({ error: "Match not found." });
    }

    return res.status(200).json({ data: match });
});

export default router;
