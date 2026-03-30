import { UUID } from "node:crypto";

import pool from "../database";

export async function GetTopics() {
    try {
        const result = await pool.query("SELECT * FROM topics");
        return result.rows;
    } catch (e) {
        console.log(e);
        return null;
    }
}

export async function AddTopic(data: string) {
    const insert = "INSERT INTO topics(topic) VALUES($1) RETURNING tid";
    const values = [data];
    try {
        await pool.query(insert, values);
        return true;
    } catch (err) {
        console.error("Insert failed:", err);
        return false;
    }
}

export async function EditTopic(tid: UUID, data: string) {
    const update = "UPDATE topics SET topic = $2 WHERE tid = $1 RETURNING tid";
    const values = [tid, data];

    try {
        await pool.query(update, values);
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
}

export async function DeleteTopic(tid: UUID) {
    try {
        await pool.query("DELETE FROM topics WHERE tid = $1", [tid]);
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
}
