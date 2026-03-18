import { Router } from "express";
import {
    GetQuestion,
    EditQuestion,
    CreateQuestion,
    DeleteQuestion,
    GetQuestions,
    GetPopularQuestions,
    SelectQuestion,
} from "../services/questionDatabase";

const router = Router();

//Get question
router.get("/questions", async (req, res) => {
    const result = await GetQuestions();
    return res.status(200).json({
        message: "Get success",
        body: result
    })
})

router.get("/questions/popular", async (req, res) => {
    const result = await GetPopularQuestions();
    return res.status(200).json({
        message: "Get success",
        body: result
    })
})



router.post("/questions/select", async (req, res) => {
    const result = await SelectQuestion(req.body.topic ?? "", req.body.difficulty ?? "");

    if (!result) {
        return res.status(404).json({
            message: "No matching question found",
        });
    }

    return res.status(200).json({
        message: "Selection success",
        data: {
            questionId: result.quid,
            question: result,
        },
    });
});

//Get question
router.post("/questions/get", async (req, res) => {
    const result = await GetQuestion(req.body.quid);

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
    const result = await CreateQuestion(req.body);
    if (!result) {
        return res.status(400).json({
            message: "Unable to save question to database",
        });
    }

    return res.status(200).json({
        message: "Question successfully added to database",
    });
});

router.put("/questions", async (req, res) => {
    const result = await EditQuestion(req.body);

    if (!result) {
        return res.status(400).json({
            message: "Unable to edit question in database",
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
            message: "Unable to delete question from database",
        });
    }

    return res.status(200).json({
        message: "Question successfully deleted from the database",
    });
});

export default router;
