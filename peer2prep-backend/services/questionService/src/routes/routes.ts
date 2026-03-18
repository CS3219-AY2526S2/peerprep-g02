import { Router } from "express";
import {
    GetQuestion,
    EditQuestion,
    CreateQuestion,
    DeleteQuestion,
    GetQuestions,
    GetPopularQuestions,
} from "../services/questionDatabase";
import { requireAdminAuth } from "../middlewares/requireAdminAuth";

const router = Router();

router.use(requireAdminAuth);

//Get question
router.get("/questions", async (req, res) => {
    const result = await GetQuestions();
    return res.status(200).json({
        message: "Get success",
        body: result,
    });
});

router.get("/questions/popular", async (req, res) => {
    const result = await GetPopularQuestions();
    return res.status(200).json({
        message: "Get success",
        body: result,
    });
});

//Save question
router.post("/questions/get", async (req, res) => {
    var result = await GetQuestion(req.body.quid);

    if (!result) {
        return res.status(400).json({
            message: "Unable to add question to database",
        });
    }

    return res.status(200).json({
        message: "Get success",
        body: result,
    });
});

//Save question
router.post("/questions", async (req, res) => {
    var result = await CreateQuestion(req.body);
    var result = true;
    if (!result) {
        return res.status(400).json({
            message: "Unable to add question to database",
        });
    }

    return res.status(200).json({
        message: "Question successfully added to database",
    });
});

router.put("/questions", async (req, res) => {
    var result = false;
    var result = await EditQuestion(req.body);

    if (!result) {
        return res.status(400).json({
            message: "Unable to add question to database",
        });
    }

    return res.status(200).json({
        message: "Question successfully edited in the database",
    });
});

router.post("/questions/delete", async (req, res) => {
    const result = await DeleteQuestion(req.body.quid);

    if (!result) {
        return res.status(400).json({
            message: "Unable to add question to database",
        });
    }

    return res.status(200).json({
        message: "Question successfully deleted from the database",
    });
});

export default router;
