//https://www.postman.com/flight-geoscientist-10690765/leetcode/request/2x0uquu/question-number?sideView=agentMode
//reference for query
const query = `
  query problemsetQuestionList(
    $skip: Int,
    $topic: [String!],
  ) {
    problemsetQuestionList: questionList(
      categorySlug: ""
      limit: 5
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
  return data.data.problemsetQuestionList.questions;
}