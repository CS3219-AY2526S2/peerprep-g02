import { UUID } from "node:crypto";
import pool from "../database"; 

export async function GetTopics() {
    try {
        const result = await pool.query('SELECT * FROM topics');
        return result.rows;
    }
    catch(e){
        console.log(e);
        return null;
    }
    
}


export async function AddTopic(data: string) {
    var success = false;
    const insert = "INSERT INTO topics(topic) VALUES($1) RETURNING tid";
    const values = [data];
    try {
        const result = await pool.query(insert, values);
        success = true;
    }
    catch (err) {
        console.error("Insert failed:", err);
        success = false;
    }
    
    return success;
}

export async function EditTopic(tid: UUID, data: string) {

    var success = false;
    const update = "UPDATE topics SET topic = $2 WHERE tid = $1 RETURNING tid";
    const values = [tid, data];

    try {
        const result = await pool.query(update, values);
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
        const result = await pool.query('DELETE FROM topics WHERE tid = $1', [tid]);
        success = true;
    }
    catch (e){
        console.log(e);
        success = false;
    }
    
    return success;
}