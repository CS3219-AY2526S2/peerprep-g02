import { UUID } from "node:crypto";

import pool from "../database";

type TestCase = {
    input: string;
    output: string;
};

type QuestionData = {
    qnTitle: string;
    qnDesc: string;
    testCase: TestCase[];
    difficulty: string;
    qnTopics: string;
    qnImage?: File | null;
};

type QuestionEdit = {
    quid: UUID;
    qnTitle: string;
    qnDesc: string;
    testCase: TestCase[];
    difficulty: string;
    qnTopics: string;
    qnImage?: File | null;
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
        return result.rows;
    } catch (e) {
        console.log(e);
        return null;
    }
}

export async function CreateQuestion(data: QuestionData) {
    const insert =
        "INSERT INTO questions(title, description,test_case,difficulty, topics) VALUES($1, $2, $3, $4, $5) RETURNING quid";
    const topics = data.qnTopics.split(",");
    const cases = JSON.stringify(data.testCase);
    const values = [data.qnTitle, data.qnDesc, cases, data.difficulty, topics];
    try {
        await pool.query(insert, values);
        return true;
    } catch (err) {
        console.error("Insert failed:", err);
        return false;
    }
}

export async function EditQuestion(data: QuestionEdit) {
    const update =
        "UPDATE questions SET title = $2, description = $3,test_case = $4, difficulty = $5, topics = $6  WHERE quid = $1 RETURNING quid";
    const topics = data.qnTopics.split(",");
    const cases = JSON.stringify(data.testCase);

    const values = [data.quid, data.qnTitle, data.qnDesc, cases, data.difficulty, topics];
    try {
        await pool.query(update, values);
        return true;
    } catch (e) {
        console.log("Edit failed:", e);
        return false;
    }
}

export async function DeleteQuestion(questionId: UUID) {
    try {
        await pool.query("DELETE FROM questions WHERE quid = $1", [questionId]);
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
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
        // Query qn_topics with JOIN to topics table to search by topic name
        const result = await pool.query(
            `SELECT qt.quid FROM qn_topics qt
             JOIN topics t ON qt.tid = t.tid
             WHERE t.topic = $1 AND qt.difficulty = $2`,
            [topic, difficulty],
        );
        if (result == undefined || result.rows.length == 0) return null;
        const allQuestions: UUID[] = result.rows.map((r: { quid: UUID }) => r.quid);
        const defaultQuestion = await randomQuestion(allQuestions);

        if (defaultQuestion == null) return null;
        if (userA == null || userB == null) return defaultQuestion[0];

        // //With attempt service
        // try {
        //     //Query
        //     const userALogs = pool.query('SELECT quid FROM attempts WHERE topics == $1 AND difficulty == $2 AND uid = $3', [topic, difficulty, userA]);
        //     const userBLogs = pool.query('SELECT quid FROM attempts WHERE topics == $1 AND difficulty == $2 AND uid = $3', [topic, difficulty, userB]);
        //     const aQuestions: UUID[] = userALogs.rows.map((r: UUID) => r);
        //     const bQuestions: UUID[] = userBLogs.rows.map((r: UUID) => r);

        //     //Get an unattempted question for both users
        //     const unattemptedBoth = allQuestions.filter((qid: UUID) => !aQuestions.includes(qid) && !bQuestions.includes(qid));
        //     if (unattemptedBoth.length >= 2) {
        //         return randomQuestion(unattemptedBoth);
        //     }
        //     //Get an unattempted question for either users
        //     const unattemptedEither = allQuestions.filter((qid: UUID) => !aQuestions.includes(qid) || !bQuestions.includes(qid));
        //     if (unattemptedEither.length >= 1) {
        //         return randomQuestion(unattemptedBoth);
        //     }

        // }
        // catch (e) {
        //     return defaultQuestion[0];
        // }
        return defaultQuestion[0];
    } catch (e) {
        console.log(e);
        return null;
    }
}
