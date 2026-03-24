import { Router } from "express";
import { UUID } from "node:crypto";

import { requireAdminAuth } from "../middlewares/requireAdminAuth";
import { getLeetCode } from "../services/leetcodeQueries";
import {
    CreateQuestion,
    DeleteQuestion,
    EditQuestion,
    GetPopularQuestions,
    GetQuestion,
    GetQuestions,
    SearchQuestion,
} from "../services/questionDatabase";
import { AddTopic, DeleteTopic, EditTopic, GetTopics } from "../services/topicsDatabase";

const router = Router();

router.use(requireAdminAuth);

//Get all question
router.get("/", async (req, res) => {
    const result = await GetQuestions();

    if (!result) {
        return res.status(400).json({
            message: "Unable to get questions from database.",
        });
    }

    return res.status(200).json({
        message: "Get questions success.",
        body: result,
    });
});

//Get popular questions
router.get("/popular", async (req, res) => {
    const result = await GetPopularQuestions();

    if (!result) {
        return res.status(400).json({
            message: "Unable to get popular questions from database.",
        });
    }
    return res.status(200).json({
        message: "Get popular question success.",
        body: result,
    });
});

//Get specified question
router.post("/get", async (req, res) => {
    const result = await GetQuestion(req.body.quid);

    if (!result) {
        return res.status(400).json({
            message: "Unable to get question from database.",
        });
    }

    return res.status(200).json({
        message: "Get question success.",
        body: result,
    });
});

//Save question
router.post("", async (req, res) => {
    var result = await CreateQuestion(req.body);
    var result = true;
    if (!result) {
        return res.status(400).json({
            message: "Unable to add question to the database.",
        });
    }

    return res.status(200).json({
        message: "Question successfully added to database",
    });
});

//Edit question
router.put("", async (req, res) => {
    var result = false;
    var result = await EditQuestion(req.body);

    if (!result) {
        return res.status(400).json({
            message: "Unable to update question in database.",
        });
    }

    return res.status(200).json({
        message: "Question successfully edited in the database.",
    });
});

//Delete question
router.delete("/:id", async (req, res) => {
    const result = await DeleteQuestion(req.params.id as UUID);

    if (!result) {
        return res.status(400).json({
            message: "Unable to delete question from database.",
        });
    }

    return res.status(200).json({
        message: "Question successfully deleted from the database.",
    });
});

//Search for matching question
router.post("/search", async (req, res) => {
    const { topic, difficulty, userA, userB } = req.body;
    const result = await SearchQuestion(topic, difficulty, userA, userB);

    if (!result) {
        return res.status(400).json({
            message: "Unable to find matching question in the database.",
        });
    }

    return res.status(200).json({
        message: "Get matching question success.",
        body: result,
    });
});

//Get leetcode question
router.post("/leetcode", async (req, res) => {
    const result = await getLeetCode(req.body.topic);

    if (!result) {
        return res.status(400).json({
            message: "Unable to retrieve leetcode questions.",
        });
    }
    return res.status(200).json({
        message: "Get leetcode questions success.",
        body: result,
    });
});

//Get topics
router.get("/topics", async (req, res) => {
    const result = await GetTopics();

    if (!result) {
        return res.status(400).json({
            message: "Unable to find topics in the database.",
        });
    }
    return res.status(200).json({
        message: "Get topics success",
        body: result,
    });
});

//Save topic
router.post("/topics", async (req, res) => {
    var result = await AddTopic(req.body.topic);
    var result = true;
    if (!result) {
        return res.status(400).json({
            message: "Unable to add topic to the database.",
        });
    }

    return res.status(200).json({
        message: "Topic successfully added to database",
    });
});

//Edit topic
router.put("/topics", async (req, res) => {
    var result = false;
    var result = await EditTopic(req.body.tid, req.body.topic);

    if (!result) {
        return res.status(400).json({
            message: "Unable to update topic in database.",
        });
    }

    return res.status(200).json({
        message: "Topic successfully edited in the database.",
    });
});

//Delete topic
router.delete("/topics/:id", async (req, res) => {
    const result = await DeleteTopic(req.params.id as UUID);

    if (!result) {
        return res.status(400).json({
            message: "Unable to delete topic from database.",
        });
    }

    return res.status(200).json({
        message: "Topic successfully deleted from the database.",
    });
});

export default router;
