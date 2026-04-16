import { UUID } from "node:crypto";

import pool from "../database";

type TopicInfo = {
    tid: UUID;
    topic: string;
    version: number;
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
    console.log(data);
    const update =
        "UPDATE topics SET topic = $2, version = version + 1 WHERE tid = $1 AND version = $3 RETURNING tid";

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        for (let i: number = 0; i < data.length; i++) {
            const topicInfo = data[i];
            const result = await client.query(update, [
                topicInfo.tid,
                topicInfo.topic,
                topicInfo.version,
            ]);
            console.log(result);
            if (result.rowCount < 1) {
                throw new Error("Wrong version detected");
            }
        }
        await client.query("COMMIT");

        return 1;
    } catch (e) {
        await client.query("ROLLBACK");
        if ((e as Error).message == "Wrong version detected") {
            return -1;
        }
        console.log(e);
    } finally {
        client.release();
    }

    return 0;
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
                console.log(result.rowCount);
                if (result.rowCount > 0) {
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
