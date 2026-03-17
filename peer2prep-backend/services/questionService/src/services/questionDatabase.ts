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
}

type QuestionEdit = {
    quid: UUID,
    qnTitle: string;
    qnDesc: string;
    testCase: TestCase[];
    difficulty: string;
    qnTopics: string; 
    qnImage?: File | null;
}

export async function GetQuestions() {
    try {
        
        const result = await pool.query('SELECT * FROM questions LIMIT 5');
        return result.rows;
    }
    catch(e){
        console.log(e)
        return null;
    }
    
}

export async function GetPopularQuestions() {
    try {
        
        const result = await pool.query('SELECT title FROM questions ORDER BY popularity_score DESC LIMIT 3');
        return result.rows;
    }
    catch(e){
        console.log(e)
        return null;
    }
    
}

export async function GetQuestion(quid: UUID) {
    try {
        const result = await pool.query('SELECT * FROM questions WHERE quid = $1', [quid]);
        return result.rows;
    }
    catch(e){
        console.log(e);
        return null;
    }
    
}

export async function CreateQuestion(data: QuestionData) {
    var success = false;
    const insert = "INSERT INTO questions(title, description,test_case,difficulty, topics) VALUES($1, $2, $3, $4, $5) RETURNING quid";
    const topics = data.qnTopics.split(",");
    const cases = JSON.stringify(data.testCase)
    const values = [data.qnTitle, data.qnDesc, cases, data.difficulty, topics];
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

export async function EditQuestion(data: QuestionEdit) {

    var success = false;
    const update = "UPDATE questions SET title = $2, description = $3,test_case = $4, difficulty = $5, topics = $6  WHERE quid = $1 RETURNING quid";
    const topics = data.qnTopics.split(",");
    const cases = JSON.stringify(data.testCase)

    const values = [data.quid, data.qnTitle, data.qnDesc, cases, data.difficulty, topics];
    try {
        const result = await pool.query(update, values);
        success = true;
    }
    catch (e) {
        console.log("Edit failed:",e);
        success = false;
    }
    
    return success;
}

export async function DeleteQuestion(questionId: Number) {
    var success = false;
    try {
        const result = pool.query('DELETE FROM questions WHERE quid = $1', [questionId]);
        success = true;
    }
    catch (e){
        console.log(e);
        success = false;
    }
    
    return success;
}
