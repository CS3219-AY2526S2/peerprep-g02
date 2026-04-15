import { Router } from "express";
import { UUID } from "node:crypto";

import { generateUploadUrl, getSignedImageUrl } from "@/services/questionImage";

import { requireAdminAuth } from "../middlewares/requireAdminAuth";
import { getLeetCode, getLeetCodeAuto } from "../services/leetcodeQueries";
import {
    CreateQuestion,
    DeleteQuestion,
    EditQuestion,
    GetPopularQuestions,
    GetQuestion,
    GetQuestions,
    SearchQuestion,
    SearchQuestionDatabase,
} from "../services/questionDatabase";
import { AddTopic, DeleteTopic, EditTopic, GetTopics } from "../services/topicDatabase";

const router = Router();

// --- PUBLIC / USER ROUTES (No Admin Required) ---

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

router.get("/leetcode", async (req, res) => {
    const result = await getLeetCodeAuto();

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

// --- ADMIN ONLY ROUTES (Middleware applied here) ---

router.use(requireAdminAuth);

router.get("/image-upload", async (req, res) => {
    const { file } = req.query;
    const url = await getSignedImageUrl(file as string);
    res.json({ url });
});

//Save question
router.post("", async (req, res) => {
    const result = await CreateQuestion(req.body);

    if (result == 0) {
        return res.status(400).json({
            message: "Unable to add question to the database.",
        });
    } else if (result == -1) {
        return res.status(409).json({
            message: "Duplicate title, try again.",
        });
    }

    return res.status(200).json({
        message: "Question successfully added to database",
    });
});

//Edit question
router.put("", async (req, res) => {
    const result = await EditQuestion(req.body);

    if (result == 0) {
        return res.status(400).json({
            message: "Unable to update question in database.",
        });
    } else if (result == -1) {
        return res.status(409).json({
            message: "Question version conflict.",
        });
    }

    return res.status(200).json({
        message: "Question successfully edited in the database.",
    });
});

//Delete question
router.delete("/:id", async (req, res) => {
    const result = await DeleteQuestion(req.params.id as UUID);

    if (result == 0) {
        return res.status(400).json({
            message: "Unable to delete question from database.",
        });
    }

    return res.status(200).json({
        message: "Question successfully deleted from the database.",
    });
});

//Search for matching question in question database
router.post("/search-database", async (req, res) => {
    const result = await SearchQuestionDatabase(req.body.title);

    if (!result) {
        return res.status(400).json({
            message: "Unable to find matching questions in the database.",
        });
    }

    return res.status(200).json({
        message: "Get matching questions success.",
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

//Save topic
router.post("/topics", async (req, res) => {
    const result = await AddTopic(req.body);

    if (result == 0) {
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
    const result = await EditTopic(req.body);

    if (result == 0) {
        return res.status(400).json({
            message: "Unable to update topic in database.",
        });
    } else if (result == -1) {
        return res.status(409).json({
            message: "Unable to update topics in database due to version conflict.",
        });
    }

    return res.status(200).json({
        message: "Topic successfully edited in the database.",
    });
});

//Delete topic
router.delete("/topics/:id", async (req, res) => {
    const result = await DeleteTopic(req.params.id as UUID);

    if (result == 0) {
        return res.status(500).json({
            message: "Unable to delete topic from database.",
        });
    }

    if (result == -1) {
        return res.status(409).json({
            message: "There are questions solely dependent on this topic.",
        });
    }

    return res.status(200).json({
        message: "Topic successfully deleted from the database.",
    });
});

// Route to generate signed URL for uploading files
router.post("/image-upload", async (req, res) => {
    try {
        const { fileName, contentType } = req.body;
        const uniqueName = `uploads/${Date.now()}-${fileName}`;
        const data = await generateUploadUrl(uniqueName, contentType);
        res.json(data);
    } catch {
        res.status(500).json({ error: "Failed to generate URL" });
    }
});

export default router;
