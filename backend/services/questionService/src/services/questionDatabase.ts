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
    qnImage?: File | null;
};

type QuestionEdit = {
    quid: UUID;
    qnTitle: string;
    qnDesc: string;
    testCase: TestCase[];
    difficulty: string;
    qnTopics: UUID[];
    qnImage?: File | null;
    qnVersion: number;
};

export async function GetQuestions() {
    try {
        const result = await pool.query("SELECT * FROM questions LIMIT 5");
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
            console.log([{ ...question, qnImage: link }]);
            return [{ ...question, qnImage: link }];
        } else {
            return result.rows;
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
    const insertQuestion =
        `INSERT INTO questions(title, description,test_case,difficulty, topics, image) 
            VALUES($1, $2, $3, $4, $5, $6) 
            RETURNING quid`;

    const topics = data.qnTopics.map((topic) => topic as UUID);

    const cases = parseTestCases(data.testCase);
    const insertQuestionValues = [data.qnTitle, data.qnDesc, cases, data.difficulty, topics, data.qnImage];
    try {
        await pool.query("BEGIN");
        const result = await pool.query(insertQuestion, insertQuestionValues);
        if (result.rowCount == 0) {
            await pool.query("ROLLBACK");
            return 0;
        }
        const quid = result.rows[0].quid;

        for (const topicId of topics) {
            await pool.query(
                "INSERT INTO qn_topics (quid, tid, difficulty) VALUES ($1, $2, $3)",
                [quid, topicId, data.difficulty]
            );
        }

        await pool.query("COMMIT");

        return result.rowCount;
    } catch (err) {
        await pool.query("ROLLBACK");
        console.error("Insert failed:", err);
    }

    return 0;

}

export async function EditQuestion(data: QuestionEdit) {

    const updateQuestion =
        `UPDATE questions 
            SET title = $2, description = $3,test_case = $4, difficulty = $5, topics = $6, image = $7 
            WHERE quid = $1 RETURNING quid`;
    const topics = data.qnTopics.map((topic) => topic as UUID);

    const cases = parseTestCases(data.testCase);
    const updateQuestionValues = [data.quid, data.qnTitle, data.qnDesc, cases, data.difficulty, topics, data.qnImage];

    try {
        await pool.query("BEGIN");
        // version check
        const check = await pool.query(
            "SELECT version FROM questions WHERE quid = $1",
            [data.quid]
        );

        if (check.rows[0].version !== data.qnVersion) {
            await pool.query("ROLLBACK");
            return -1;
        }

        const result = await pool.query(updateQuestion, updateQuestionValues);
        if (result.rowCount == 0) {
            await pool.query("ROLLBACK");
            return 0;
        }

        await pool.query(
            `UPDATE qn_topics 
                SET difficulty = $1 
                WHERE quid = $2`,
            [data.difficulty, data.quid]
        );

        await pool.query("COMMIT");

        return result.rowCount;


    } catch {
        await pool.query("ROLLBACK");
        console.log("Edit failed");
    }

    return 0;
}

export async function DeleteQuestion(questionId: UUID) {
    try {
        const getResult = await pool.query("SELECT * FROM questions WHERE quid = $1", [questionId]);
        const question = getResult.rows[0];
        if (question.image !== null) {
            const deleteImageResult = await deleteImage(question.image);
            if (!deleteImageResult) {
                return 0;
            }
        }
        const result = await pool.query("DELETE FROM questions WHERE quid = $1", [questionId]);

        return result.rowCount;
    } catch (e) {
        console.log(e);
    }

    return 0;
}

async function randomQuestion(questions: UUID[]) {
    const randomIndex = Math.floor(Math.random() * questions.length);
    const result = await GetQuestion(questions[randomIndex]);
    return result;
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
            "SELECT quid FROM qn_topics WHERE tid = $1 AND difficulty = $2",
            [topic, difficulty],
        );
        if (result == undefined || result.rows.length == 0) return null;
        const allQuestions: UUID[] = result.rows.map((r: { quid: UUID }) => r.quid);
        const defaultQuestion = await randomQuestion(allQuestions);

        if (defaultQuestion == null) return null;
        if (userA == null || userB == null) return defaultQuestion[0];

        // //With attempt service
        try {
            //Query
            const userARes = await fetch(
                `http://attempt-service:3004/v1/api/attempts/internal/users/${userA}/questions`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "x-internal-auth": process.env.INTERNAL_SERVICE_API_KEY!,
                    },
                }
            );

            const userBRes = await fetch(
                `http://attempt-service:3004/v1/api/attempts/internal/users/${userB}/questions`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "x-internal-auth": process.env.INTERNAL_SERVICE_API_KEY!,
                    },
                }
            );

            const userAData = await userARes.json();
            const userBData = await userBRes.json();


            const aQuestions: UUID[] = userAData.data.questionIds.map((r: UUID) => r);
            const bQuestions: UUID[] = userBData.data.questionIds.map((r: UUID) => r);

            //Get an unattempted question for both users
            const unattemptedBoth = allQuestions.filter((qid: UUID) => !aQuestions.includes(qid) && !bQuestions.includes(qid));
            if (unattemptedBoth.length >= 2) {
                return randomQuestion(unattemptedBoth);
            }
            //Get an unattempted question for either users
            const unattemptedEither = allQuestions.filter((qid: UUID) => !aQuestions.includes(qid) || !bQuestions.includes(qid));
            if (unattemptedEither.length >= 1) {
                return randomQuestion(unattemptedBoth);
            }

        }
        catch {
            return defaultQuestion[0];
        }
        return defaultQuestion[0];
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
