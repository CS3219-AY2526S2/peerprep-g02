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
    let valueStr = "";
    for (let i = 0; i < data.length; i++) {
        const topic = data[i].topic.replace(/'/g, "''"); // escape single quotes
        if (i === data.length - 1) {
            valueStr += `('${topic}')`;
        } else {
            valueStr += `('${topic}'),`;
        }
    }

    const insert = `INSERT INTO topics(topic) VALUES ${valueStr} RETURNING tid;`;

    try {
        const result = await pool.query(insert);
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
    try {
        const allQuid = await pool.query("SELECT quid FROM qn_topics WHERE tid = $1", [tid]);
        await Promise.all(
            allQuid.rows.map((row: any) =>
                pool.query("DELETE FROM questions WHERE quid = $1", [row.quid]),
            ),
        );
        const result = await pool.query("DELETE FROM topics WHERE tid = $1", [tid]);
        return result.rowCount;
    } catch (e) {
        console.log(e);
    }

    return 0;
}
