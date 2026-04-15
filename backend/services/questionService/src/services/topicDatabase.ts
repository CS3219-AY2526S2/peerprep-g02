import { UUID } from "node:crypto";

import pool from "../database";

type TopicInfo = {
    tid: UUID;
    topic: string;
};

export async function GetTopics() {
    try {
        const result = await pool.query("SELECT * FROM topics");
        return result.rows;
    } catch (e) {
        console.log(e);
        return null;
    }
}

export async function AddTopic(data: TopicInfo[]) {
    if (data.length == 0) return 0;
    const values = data.map((topicInfo) => topicInfo.topic);
    const placeholders = data.map((_: TopicInfo, index: number) => `($${index + 1})`).join(",");
    const insert = `INSERT INTO topics(topic) VALUES ${placeholders} RETURNING tid;`;

    try {
        const result = await pool.query(insert, values);
        return result.rowCount;
    } catch (err) {
        console.error("Insert failed:", err);
    }

    return 0;
}

export async function EditTopic(data: TopicInfo[]) {
    const update = "UPDATE topics SET topic = $2 WHERE tid = $1 RETURNING tid";
    try {
        const result = await Promise.all(
            data.map((topicInfo: TopicInfo) =>
                pool.query(update, [topicInfo.tid, topicInfo.topic]),
            ),
        );
        return result;
    } catch (e) {
        console.log(e);
    }

    return null;
}

export async function DeleteTopic(tid: UUID) {
    console.log("called");
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const allQuid = await client.query("SELECT quid FROM qn_topics WHERE tid = $1", [tid]);
        console.log(allQuid);
        await client.query("DELETE FROM qn_topics WHERE tid = $1", [tid]);
        await Promise.all(
            allQuid.rows.map(async (row: any) => {
                const result = await client.query("SELECT topics FROM questions WHERE quid = $1", [
                    row.quid,
                ]);
                console.log(result.rows);
                if (result.rows.length > 0) {
                    const currentTopics: UUID[] = result.rows[0].topics;
                    console.log(currentTopics);
                    console.log(result.rows[0].topics);
                    if (currentTopics.length == 1) {
                        throw new Error("Question is dependent on this topic");
                    }

                    const updatedTopics = currentTopics.filter((topic: UUID) => topic !== tid);

                    await client.query("UPDATE questions SET topics = $1 WHERE quid = $2", [
                        updatedTopics,
                        row.quid,
                    ]);
                }
            }),
        );
        const result = await client.query("DELETE FROM topics WHERE tid = $1", [tid]);
        await client.query("COMMIT");
        return result.rowCount;
    } catch (e) {
        console.log(e);
        await client.query("ROLLBACK");
        if ((e as Error).message == "Question is dependent on this topic") {
            return -1;
        }
        console.log(e);
        return 0;
    } finally {
        client.release();
    }
}
