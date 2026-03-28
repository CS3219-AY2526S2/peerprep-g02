import pool from "../database";

//https://www.postman.com/flight-geoscientist-10690765/leetcode/request/2x0uquu/question-number?sideView=agentMode
//reference for query
const query = `
  query problemsetQuestionList(
    $skip: Int,
    $limit: Int,
    $topic: [String!]
  ) {
    problemsetQuestionList: questionList(
      categorySlug: ""
      limit: $limit
      skip: $skip
      filters: {tags: $topic}
    ) {
      total: totalNum
      questions: data {
        acRate
        difficulty
        freqBar
        frontendQuestionId: questionFrontendId
        isFavor
        paidOnly: isPaidOnly
        status
        title
        titleSlug
        topicTags {
          name
          id
          slug
        }
        hasSolution
        hasVideoSolution
      }
    }
  }
`;


export async function getLeetCodeTotal(topic:string) {
    const queryVars = {
    skip: 0,
    limit: 5,
    topic: topic
  }
  const response = await fetch('https://leetcode.com/graphql/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: query, variables: queryVars }),
  });

  const data = await response.json();
  return data.data.problemsetQuestionList;
}

export async function getLeetCode(topic: String) {
  const queryVars = {
    skip: 0,
    topic: topic
  }
  const response = await fetch('https://leetcode.com/graphql/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: query, variables: queryVars }),
  });

  const data = await response.json();
  return data.data.problemsetQuestionList;
}

export async function getLeetCodeAuto() {
  const total = await getLeetCodeTotal("").then(result => result.total);
  console.log(total);
  let topics = null;
  try {
    const query = `SELECT t.topic, COUNT(qt.quid) AS question_count
                  FROM topics t
                  LEFT JOIN qn_topics qt ON qt.tid = t.tid
                  GROUP BY t.tid, t.topic
                  HAVING COUNT(qt.quid) <= 5
                  ORDER BY question_count ASC;`
    topics = await pool.query(query);
    console.log(topics.rows)
    if (topics.rows.length === 0) {
      return [];
    }
  } catch (e) {
    console.log(e);
    return [];
  }
  const topicNames: string[] = topics.rows.map((row: any) => row.topic);
  console.log(topicNames);

  for (const topic of topicNames) {
    console.log(topic);
    const result = await getLeetCodeTotal(topic);
      if (result.total < total) {
      return result.questions;
    }
  }

  return [];
}