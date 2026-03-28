import { UUID } from "node:crypto";
import pool from "../database";


type TopicInfo = {
    tid: UUID,
    topic: string
}

export async function GetTopics() {
    try {
        const result = await pool.query('SELECT * FROM topics');
        return result.rows;
    }
    catch (e) {
        console.log(e);
        return null;
    }

}


export async function AddTopic(data: TopicInfo[]) {
    var success = false;

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

    console.log(insert);

    try {
        const result = await pool.query(insert);
        success = true;
    }
    catch (err) {
        console.error("Insert failed:", err);
        success = false;
    }

    return success;
}

export async function EditTopic(data: TopicInfo[]) {
    console.log(data);
    var success = false;
    const update = "UPDATE topics SET topic = $2 WHERE tid = $1 RETURNING tid";
    try {
        const result = await Promise.all(
            data.map((topicInfo: TopicInfo) =>
                pool.query(update, [topicInfo.tid, topicInfo.topic])
            )
        );
        success = true;
    }
    catch (e) {
        console.log(e);
        success = false;
    }

    return success;
}

export async function DeleteTopic(tid: UUID) {
    var success = false;
    try {
        const allQuid = await pool.query("SELECT quid FROM qn_topics WHERE tid = $1", [tid]);
        await Promise.all(
            allQuid.rows.map((row: any) =>
                pool.query("DELETE FROM questions WHERE quid = $1", [row.quid])
            )
        );
        const result = await pool.query("DELETE FROM topics WHERE tid = $1", [tid]);
        success = true;
    }
    catch (e) {
        console.log(e);
        success = false;
    }

    return success;
}