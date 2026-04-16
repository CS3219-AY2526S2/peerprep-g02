import { UUID } from "node:crypto";

import pool from "../database";
import { deleteImage, getSignedImageUrl } from "./questionImage";

type TestCase = {
    input: string;
    output: string;
};

type QuestionData = {
    qnTitle: string;
    qnDesc: string;
    testCase: TestCase[];
    difficulty: string;
    qnTopics: UUID[];
    qnImage?: string | null;
};

type QuestionEdit = {
    quid: UUID;
    qnTitle: string;
    qnDesc: string;
    testCase: TestCase[];
    difficulty: string;
    qnTopics: UUID[];
    qnImage?: string | null;
    version: number;
};

export async function GetQuestions() {
    try {
        const result = await pool.query("SELECT * FROM questions ORDER BY updated_at DESC LIMIT 5");
        return result.rows;
    } catch (e) {
        console.log(e);
        return null;
    }
}

export async function GetPopularQuestions() {
    try {
        const result = await pool.query(
            "SELECT title FROM questions ORDER BY popularity_score DESC LIMIT 3",
        );
        return result.rows;
    } catch (e) {
        console.log(e);
        return null;
    }
}

export async function GetQuestion(quid: UUID) {
    try {
        const result = await pool.query("SELECT * FROM questions WHERE quid = $1", [quid]);
        if (result.rowCount == 0) return null;

        const question = result.rows[0];
        if (question.image !== null) {
            const link = await getSignedImageUrl(question.image);
            return [{ ...question, qnImage: link }];
        } else {
            return [{ ...question, qnImage: null }];
        }
    } catch (e) {
        console.log(e);
        return null;
    }
}

function safeJsonParse(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        // If parsing fails, fall back to the original string to avoid throwing.
        return value;
    }
}

function parseTestCases(testCases: TestCase[]): string {
    return JSON.stringify(
        testCases.map((tc) => ({
            input: typeof tc.input === "string" ? safeJsonParse(tc.input) : tc.input,
            output: typeof tc.output === "string" ? safeJsonParse(tc.output) : tc.output,
        })),
    );
}

export async function CreateQuestion(data: QuestionData) {
    const insertQuestion = `INSERT INTO questions(title, description,test_case,difficulty, topics, image, function_name)
            VALUES($1, $2, $3, $4, $5, $6, $7)
            RETURNING quid`;

    const topics = data.qnTopics.map((topic) => topic as UUID);
    const functionName = data.qnTitle
        .split(/\s+/)
        .map((word, i) =>
            i === 0
                ? word.toLowerCase()
                : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join("");

    const cases = parseTestCases(data.testCase);
    const insertQuestionValues = [
        data.qnTitle,
        data.qnDesc,
        cases,
        data.difficulty,
        topics,
        data.qnImage,
        functionName,
    ];

    const duplicates = await pool.query("SELECT title FROM questions WHERE title = $1", [
        data.qnTitle,
    ]);
    if (duplicates.rowCount > 0) {
        if (data.qnImage !== undefined && data.qnImage !== null) {
            // Image was already uploaded in frontend, need to delete since the creation did not go through
            await deleteImage(data.qnImage).catch((e) => console.log(e));
        }
        return -1;
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const result = await client.query(insertQuestion, insertQuestionValues);
        if (result.rowCount == 0) {
            throw new Error("Failed to insert question.");
        }
        const quid = result.rows[0].quid;

        for (const topicId of topics) {
            await client.query(
                "INSERT INTO qn_topics (quid, tid, difficulty) VALUES ($1, $2, $3)",
                [quid, topicId, data.difficulty],
            );
        }

        await client.query("COMMIT");

        return result.rowCount;
    } catch (err) {
        await client.query("ROLLBACK");
        if (data.qnImage !== undefined && data.qnImage !== null) {
            // Image was already uploaded in frontend, need to delete since the creation did not go through
            await deleteImage(data.qnImage).catch((e) => console.log(e));
        }
        console.error("Insert failed:", err);
    } finally {
        client.release();
    }

    return 0;
}

export async function EditQuestion(data: QuestionEdit) {
    console.log(data);
    const updateQuestion = `UPDATE questions 
            SET title = $2, description = $3,test_case = $4, difficulty = $5, topics = $6, image = $7, updated_at = NOW(), version = version + 1 
            WHERE quid = $1 RETURNING quid`;
    const topics = data.qnTopics.map((topic) => topic as UUID);

    const cases = parseTestCases(data.testCase);
    const updateQuestionValues = [
        data.quid,
        data.qnTitle,
        data.qnDesc,
        cases,
        data.difficulty,
        topics,
        data.qnImage,
    ];

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        // version check
        const check = await client.query("SELECT version, image FROM questions WHERE quid = $1", [
            data.quid,
        ]);

        if (check.rowCount == 0) {
            throw new Error("Question not found.");
        }
        const currentQuestion = check.rows[0];
        if (currentQuestion.version !== data.version) {
            await client.query("ROLLBACK");
            return -1;
        }

        //Reinsert topic mapping and difficulty
        await client.query("DELETE FROM qn_topics WHERE quid = $1", [data.quid]);

        for (const topicId of topics) {
            await client.query(
                "INSERT INTO qn_topics (quid, tid, difficulty) VALUES ($1, $2, $3)",
                [data.quid, topicId, data.difficulty],
            );
        }

        //Update the values within the question
        const result = await client.query(updateQuestion, updateQuestionValues);
        if (result.rowCount == 0) {
            throw new Error("Failed to update question");
        }

        if (
            currentQuestion.image !== data.qnImage &&
            currentQuestion.image !== undefined &&
            currentQuestion.image !== null
        ) {
            const isSuccess = await deleteImage(currentQuestion.image);
            if (!isSuccess) {
                throw new Error("Failed to delete image");
            }
        }

        await client.query("COMMIT");

        return result.rowCount;
    } catch (e) {
        console.log(e);
        await client.query("ROLLBACK");
        if (data.qnImage !== undefined && data.qnImage !== null) {
            // Image was already uploaded in frontend, need to delete since the edit did not go through
            await deleteImage(data.qnImage).catch((e) => console.log(e));
        }
        console.log("Edit failed");
    } finally {
        client.release();
    }

    return 0;
}

export async function DeleteQuestion(questionId: UUID) {
    try {
        const getResult = await pool.query("SELECT * FROM questions WHERE quid = $1", [questionId]);
        if (getResult.rows == 0) {
            return 0;
        }
        const question = getResult.rows[0];

        const result = await pool.query("DELETE FROM questions WHERE quid = $1", [questionId]);
        if (question.image !== null) {
            const deleteImageResult = await deleteImage(question.image);
            if (!deleteImageResult) {
                return 0;
            }
        }
        return result.rowCount;
    } catch (e) {
        console.log(e);
    }

    return 0;
}

async function randomQuestion(questions: UUID[]) {
    const randomIndex = Math.floor(Math.random() * questions.length);
    const result = await GetQuestion(questions[randomIndex]);
    return result == null ? null : result[0];
}

export async function SearchQuestion(
    topic: string,
    difficulty: string,
    userA: UUID | null,
    userB: UUID | null,
) {
    try {
        //Default random question
        const result = await pool.query(
            "SELECT qt.quid FROM qn_topics qt WHERE qt.tid = $1 AND qt.difficulty = $2",
            [topic, difficulty],
        );
        if (result == undefined || result.rows.length == 0) return null;
        const allQuestions: UUID[] = result.rows.map((r: { quid: UUID }) => r.quid);
        const defaultQuestion = await randomQuestion(allQuestions);

        if (defaultQuestion == null) return null;
        if (userA == null || userB == null) return defaultQuestion;

        // With attempt service
        try {
            //Query
            const userARes = await fetch(
                `http://attempts-service:3004/attempts/users/${userA}/questions`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "x-internal-service-key": process.env.INTERNAL_SERVICE_API_KEY!,
                    },
                },
            );

            const userBRes = await fetch(
                `http://attempts-service:3004/attempts/users/${userB}/questions`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "x-internal-service-key": process.env.INTERNAL_SERVICE_API_KEY!,
                    },
                },
            );

            const userAData = await userARes.json();
            const userBData = await userBRes.json();

            const aQuestions: UUID[] = userAData.data.questionIds.map((r: UUID) => r);
            const bQuestions: UUID[] = userBData.data.questionIds.map((r: UUID) => r);

            //Get an unattempted question for both users
            const unattemptedBoth = allQuestions.filter(
                (qid: UUID) => !aQuestions.includes(qid) && !bQuestions.includes(qid),
            );

            if (unattemptedBoth.length >= 1) {
                return randomQuestion(unattemptedBoth);
            }

            //Get an unattempted question for either users
            const unattemptedEither = allQuestions.filter(
                (qid: UUID) => !aQuestions.includes(qid) || !bQuestions.includes(qid),
            );

            if (unattemptedEither.length >= 1) {
                return randomQuestion(unattemptedEither);
            }
        } catch {
            return defaultQuestion;
        }
        return defaultQuestion;
    } catch (e) {
        console.log(e);
        return null;
    }
}

export async function SearchQuestionDatabase(title: string) {
    try {
        console.log(title);
        const result = await pool.query("SELECT * FROM questions WHERE LOWER(title) LIKE $1", [
            `%${title.trim().toLowerCase()}%`,
        ]);
        return result.rows;
    } catch (e) {
        console.log(e);
        return null;
    }
}

export async function UpdateQuestionPopularityScore(quid: string) {
    try {
        const query =
            "UPDATE questions SET popularity_score = popularity_score + 1 WHERE quid = $1";
        const result = await pool.query(query, [quid]);

        return result.rowCount > 0 ? 200 : 500;
    } catch {
        return 500;
    }
}
