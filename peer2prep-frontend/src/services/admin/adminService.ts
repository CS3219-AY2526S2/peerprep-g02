import { QuestionData, QuestionInfo, TestCase } from "../../components/admin/AdminType";
import { UUID } from "node:crypto";


export const testLeetCode = async(): Promise<number> => {
    try {
        const res = await fetch("http://localhost:3005/v1/api/api/leetcode", {
        method: "GET",
        headers: {
        "Content-Type": "application/json",
        "cache-control": "no-cache"
        
        }
        });
        const data = await res.json();
        console.log(data.body)
        

    } catch (e: any) {
        
        console.log(e);
        return 0;
    }
    return 0;
}

export const getQuestions = async(): Promise<QuestionInfo[] | null> => {    
    try {
        testLeetCode();
        const res = await fetch("http://localhost:3005/v1/api/questions", {
        method: "GET",
        headers: {
        "Content-Type": "application/json",
        
        },
        credentials: "include"
        });
        const data = await res.json();
        if (data == null ) {
            return null;
        }
        const questions: QuestionInfo[] = data.body.map((item: any) => ({
            quid: item.quid,
            title: item.title,
            topics: item.topics,
            difficulty: item.difficulty,
        }));
        return questions;

    } catch (e: any) {
        console.log(e);
        return null;
    }
}

export const getPopularQuestions = async(): Promise<String[] | null> => {    
    try {
        const res = await fetch("http://localhost:3005/v1/api/questions/popular", {
        method: "GET",
        headers: {
        "Content-Type": "application/json",
        
        },
        credentials: "include"
        });

        const data = await res.json();
        const result: String[] = data.body.map((item: any) => item.title);
        if (data == null ) {
            return null;
        }
        return result;

    } catch (e: any) {
        console.log(e);
        return null;
    }
}


export const getQuestion = async(id: UUID | null): Promise<QuestionData| null> => {    
    try {
        if (id == null) {
            return null;
        }
        const res = await fetch("http://localhost:3005/v1/api/questions/get", {
            method: "POST",
            headers: {
            "Content-Type": "application/json",
            },
            body: JSON.stringify({ quid: id }),
        });

        const result = await res.json();
        const data = result.body[0];

        if (data == null ) {
            return null;
        }

        const cases: TestCase[] = data.test_case.map((item: any) => ({
            input: JSON.stringify(item.input),
            output: JSON.stringify(item.output)
        }));
        const question = {
            quid: data.quid,
            title: data.title,
            topics: data.topics,
            difficulty: data.difficulty,
            testCase: cases,
            description: data.description
        };
        return question;

    } catch (e: any) {
        console.log(e);
        return null;
    }
}

export const createQuestion = async(data: string): Promise<number> => {   
    const res = await fetch("http://localhost:3005/v1/api/questions", {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        },
        body: data,
    });

    return res.status;
}

export const editQuestion = async(data: string): Promise<number> => {    
    const res = await fetch("http://localhost:3005/v1/api/questions", {
        method: "PUT",
        headers: {
        "Content-Type": "application/json",
        },
        body: data,
    });

    return res.status;
}

export const deleteQuestion = async(id: UUID): Promise<number> => {    
    const res = await fetch("http://localhost:3005/v1/api/questions/delete", {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        },
        body: JSON.stringify({ quid: id }),
    });

    return res.status;
}