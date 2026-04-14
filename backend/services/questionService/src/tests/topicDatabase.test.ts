// import { describe, it, expect, vi, beforeEach } from "vitest";

// // 👇 mock BEFORE importing the functions
// vi.mock("../database", () => {
//   return {
//     default: {
//       query: vi.fn(),
//     },
//   };
// });

// import pool from "../database";
// import { GetTopics, AddTopic, EditTopic, DeleteTopic } from "../services/topicDatabase"; // adjust path
// import { UUID } from "crypto";

// const mockedQuery = pool.query as unknown as ReturnType<typeof vi.fn>;

// type TopicInfo = {
//     tid: UUID;
//     topic: string;
// };

// beforeEach(() => {
//   vi.clearAllMocks();
// });

// describe("Topic Service", () => {
//   // ✅ GetTopics
//   it("should return topics", async () => {
//     mockedQuery.mockResolvedValue({
//       rows: [{ tid: "1", topic: "math" }],
//     });

//     const result = await GetTopics();

//     expect(mockedQuery).toHaveBeenCalledWith("SELECT * FROM topics");
//     expect(result).toEqual([{ tid: "1", topic: "math" }]);
//   });

//   it("should return null on error", async () => {
//     mockedQuery.mockRejectedValue(new Error("DB error"));

//     const result = await GetTopics();

//     expect(result).toBeNull();
//   });

//   // ✅ AddTopic
//   it("should insert topics and return rowCount", async () => {
//     mockedQuery.mockResolvedValue({ rowCount: 2 });

//     const data: TopicInfo[] = [
//             { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0542", topic: "Array" },
//             { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0543", topic: "String" },
//         ];

//     const result = await AddTopic(data);

//     expect(mockedQuery).toHaveBeenCalledWith(
//       expect.stringContaining("INSERT INTO topics"),
//       ["Array", "String"]
//     );
//     expect(result).toBe(2);
//   });

//   it("should return 0 if empty input", async () => {
//     const result = await AddTopic([]);
//     expect(result).toBe(0);
//     expect(mockedQuery).not.toHaveBeenCalled();
//   });

//   // ✅ EditTopic
//   it("should update topics", async () => {
//     mockedQuery.mockResolvedValue({ tid: "1" });

//     const data: TopicInfo[] = [
//             { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0542", topic: "Array" },

//         ];

//     const result = await EditTopic(data);

//     expect(mockedQuery).toHaveBeenCalledWith(
//       "UPDATE topics SET topic = $2 WHERE tid = $1 RETURNING tid",
//       ["5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0542", "Array"]
//     );
//     expect(result).not.toBeNull();
//   });

//   // ✅ DeleteTopic
//   it("should delete topic and related questions", async () => {
//     mockedQuery
//       // first query: get quid
//       .mockResolvedValueOnce({
//         rows: [{ quid: "q1" }, { quid: "q2" }],
//       })
//       // delete questions
//       .mockResolvedValueOnce({})
//       .mockResolvedValueOnce({})
//       // delete topic
//       .mockResolvedValueOnce({ rowCount: 1 });

//     const result = await DeleteTopic("1" as any);

//     expect(mockedQuery).toHaveBeenCalledWith(
//       "SELECT quid FROM qn_topics WHERE tid = $1",
//       ["1"]
//     );

//     expect(result).toBe(1);
//   });
// });
