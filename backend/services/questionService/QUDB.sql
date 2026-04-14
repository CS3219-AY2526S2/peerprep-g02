CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE questions (
    quid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    topics UUID[] NOT NULL,
    image TEXT,
    test_case JSON,
    popularity_score INT DEFAULT 0,
    function_name TEXT NOT NULL DEFAULT ''
);

CREATE TABLE topics (
    tid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL
);

CREATE TABLE qn_topics (
    quid UUID,
    tid UUID,
    difficulty TEXT NOT NULL,

    PRIMARY KEY (quid, tid),

    FOREIGN KEY (quid) REFERENCES questions(quid) ON DELETE CASCADE,
    FOREIGN KEY (tid) REFERENCES topics(tid)
);

CREATE INDEX qn_topic_difficulty ON qn_topics(tid, difficulty);

-- Fixed the UUID on initialization to prevent random UUID from generating and breaking the queries.

--Topic
INSERT INTO topics (tid, topic) 
VALUES
    ('12ce1abf-7060-404e-bcb9-671e9d5c55e4', 'Array'),
    ('e6811add-b0a5-4ef2-b105-affae358efc5', 'Strings'),
    ('46be1b65-0d60-4906-b229-003c0147a20a', 'Algorithms'),
    ('fa30e02b-79c2-4134-b180-b62e51f9ea03', 'Data Structures'),
    ('77856f4f-70c4-4e65-95b4-8b59ea769296', 'Bit Manipulation'),
    ('8d58e050-fcb9-4761-9982-d1703de69948', 'Recursion'),
    ('75dfe195-825a-4260-ba85-29bbf71d185b', 'Databases'),
    ('1333d309-33bc-4f5d-8e13-f241e5b519fa', 'Arrays'),
    ('3f78df1b-bcbc-4e58-b3f4-f139fe8acae1', 'Brainteaser');

--Question
INSERT INTO questions (
    quid,
    title,
    description,
    difficulty,
    topics,
    test_case,
    function_name
)
VALUES
    (
        '3d9fd353-797d-4797-97a2-fb060553ce16',
        'Reverse a String',
        'Write a function that reverses a string. The input string is given as an array of characters s. You must do this by modifying the input array in-place with O(1) extra memory.',
        'Easy',
        '{"12ce1abf-7060-404e-bcb9-671e9d5c55e4", "e6811add-b0a5-4ef2-b105-affae358efc5"}',
        '[{"input": [["h","e","l","l","o"]], "output": ["o","l","l","e","h"]}]',
        'reverseString'
    ),
    (
        '230d15b4-78d5-4338-a7a6-be8db6e10753',
        'Linked List Cycle Detection',
        'Implement a function to detect if a linked list contains a cycle.',
        'Easy',
        '{"fa30e02b-79c2-4134-b180-b62e51f9ea03", "46be1b65-0d60-4906-b229-003c0147a20a"}',
        '[{"input": [[3, 2, 0, -4]], "output": "Cycle detected"}]',
        'hasCycle'
    ),
    (
        '73403133-0bb3-4c9f-ad31-b8b804b6845b',
        'Roman to Integer',
        'Given a roman numeral, convert it to an integer.',
        'Easy',
        '{"46be1b65-0d60-4906-b229-003c0147a20a"}',
        '[{"input": ["III"], "output": 3}]',
        'romanToInt'
    ),
    (
        '6cdca01d-80bf-4de8-b222-39486838351c',
        'Add Binary',
        'Given two binary strings a and b, return their sum as a binary string.',
        'Easy',
        '{"77856f4f-70c4-4e65-95b4-8b59ea769296", "46be1b65-0d60-4906-b229-003c0147a20a"}',
        '[{"input": ["1010", "1011"], "output": "10101"}]',
        'addBinary'
    ),
    (
        '4022c1dc-f74b-466d-aa6a-5e3fa0f42453',
        'Fibonacci Number',
        'The Fibonacci numbers, commonly denoted F(n) form a sequence such that each number is the sum of the two preceding ones, starting from 0 and 1. Given n, calculate F(n).',
        'Easy',
        '{"8d58e050-fcb9-4761-9982-d1703de69948", "46be1b65-0d60-4906-b229-003c0147a20a"}',
        '[{"input": [3], "output": 2}]',
        'fib'
    ),
    (
        '7de26940-b5c3-446e-91e9-d92d2c526cee',
        'Implement Stack using Queues',
        'Implement a last-in-first-out (LIFO) stack using only two queues. The implemented stack should support all the functions of a normal stack (push, top, pop, and empty).',
        'Easy',
        '{"fa30e02b-79c2-4134-b180-b62e51f9ea03"}',
        '[{"input": [["push(1)", "push(2)", "top()", "pop()", "top()"]], "output": [2, 1]}]',
        'stackUsingQueues'
    ),
    (
        'a7dc2628-31a6-4a2a-83da-16bebaa91363',
        'Combine Two Tables',
        'Given table Person and table Address, write a solution to report the first name, last name, city, and state of each person in the Person table. If the address of a personId is not present in the Address table, report null instead.',
        'Easy',
        '{"75dfe195-825a-4260-ba85-29bbf71d185b"}',
        '[{"input": ["Person table", "Address table"], "output": [["John", "Doe", "New York", "NY"], ["Jane", "Smith", null, null]]}]',
        'combineTables'
    ),
    (
        'd3635fbe-1a99-421c-af81-229ee9608948',
        'Repeated DNA Sequences',
        'Given a DNA sequence, return all the 10-letter-long sequences (substrings) that occur more than once in the DNA. You may return the answer in any order.',
        'Medium',
        '{"46be1b65-0d60-4906-b229-003c0147a20a", "77856f4f-70c4-4e65-95b4-8b59ea769296"}',
        '[{"input": ["AAAAACCCCCAAAAACCCCCCAAAAAGGGTTT"], "output": ["AAAAACCCCC", "CCCCCAAAAA"]}]',
        'findRepeatedDnaSequences'
    ),
    (
        'c807ed97-7653-437e-88fb-396ce18a5396',
        'Course Schedule',
        'Given a total of numCourses courses and an array of prerequisites, return true if you can finish all courses. Otherwise, return false.',
        'Medium',
        '{"fa30e02b-79c2-4134-b180-b62e51f9ea03", "46be1b65-0d60-4906-b229-003c0147a20a"}',
        '[{"input": [2, [[1, 0]]], "output": true}]',
        'canFinish'
    ),
    (
        '7309cd44-6d64-4c94-95bd-756fa8eefa43',
        'LRU Cache',
        'Design and implement an LRU (Least Recently Used) cache.',
        'Medium',
        '{"fa30e02b-79c2-4134-b180-b62e51f9ea03"}',
        '[{"input": [["put(1, 1)", "put(2, 2)", "get(1)", "put(3, 3)", "get(2)"]], "output": [1, -1]}]',
        'lruCache'
    ),
    (
        'a5e621ca-b4b2-437a-a76e-fea9303ed561',
        'Longest Common Subsequence',
        'Given two strings text1 and text2, return the length of their longest common subsequence. If there is no common subsequence, return 0.',
        'Medium',
        '{"e6811add-b0a5-4ef2-b105-affae358efc5", "46be1b65-0d60-4906-b229-003c0147a20a"}',
        '[{"input": ["abcde", "ace"], "output": 3}]',
        'longestCommonSubsequence'
    ),
    (
        'f0543396-6f85-4962-9aad-1c08e9b46934',
        'Rotate Image',
        'You are given an n x n 2D matrix representing an image. Rotate the image by 90 degrees clockwise.',
        'Medium',
        '{"1333d309-33bc-4f5d-8e13-f241e5b519fa", "46be1b65-0d60-4906-b229-003c0147a20a"}',
        '[{"input": [[[1, 2, 3], [4, 5, 6], [7, 8, 9]]], "output": [[7, 4, 1], [8, 5, 2], [9, 6, 3]]}]',
        'rotate'
    ),
    (
        'e989e3fc-7224-454d-acbe-32ecb7c606ad',
        'Airplane Seat Assignment Probability',
        'n passengers board an airplane with exactly n seats. The first passenger has lost their ticket and picks a seat randomly. After that, the rest of the passengers will take their own seat if available, or pick other seats randomly. Return the probability that the nth person gets their own seat.',
        'Medium',
        '{"3f78df1b-bcbc-4e58-b3f4-f139fe8acae1"}',
        '[{"input": [3], "output": 0.5}]',
        'nthPersonGetsNthSeat'
    ),
    (
        '0631a318-191d-4515-9fe3-72d925ecace8',
        'Validate Binary Search Tree',
        'Given the root of a binary tree, determine if it is a valid binary search tree (BST).',
        'Medium',
        '{"fa30e02b-79c2-4134-b180-b62e51f9ea03", "46be1b65-0d60-4906-b229-003c0147a20a"}',
        '[{"input": [{"val": 2, "left": {"val": 1}, "right": {"val": 3}}], "output": true}]',
        'isValidBST'
    ),
    (
        '243e8ad8-49f3-46ac-a017-e6f505d0eaa2',
        'Sliding Window Maximum',
        'You are given an array of integers nums. There is a sliding window of size k which is moving from the very left of the array to the very right. You can only see the k numbers in the window. Each time the sliding window moves right by one position, return the maximum sliding window.',
        'Hard',
        '{"1333d309-33bc-4f5d-8e13-f241e5b519fa", "46be1b65-0d60-4906-b229-003c0147a20a"}',
        '[{"input": [[1, 3, -1, -3, 5, 3, 6, 7], 3], "output": [3, 3, 5, 5, 6, 7]}]',
        'maxSlidingWindow'
    ),
    (
        'e8fd0042-e7d8-4a1f-84bc-060fbd57cfda',
        'N-Queen Problem',
        'The n-queens puzzle is the problem of placing n queens on an n x n chessboard such that no two queens attack each other. Given an integer n, return all distinct solutions to the n-queens puzzle. You may return the answer in any order.',
        'Hard',
        '{"46be1b65-0d60-4906-b229-003c0147a20a"}',
        '[{"input": [4], "output": [[".Q..", "...Q", "Q...", "..Q."], ["..Q.", "Q...", "...Q", ".Q.."]]}]',
        'solveNQueens'
    ),
    (
        '03603811-8f78-4cbd-9231-6eaa750f4c57',
        'Serialize and Deserialize a Binary Tree',
        'Serialization is the process of converting a data structure or object into a sequence of bits so that it can be stored in a file or memory buffer, or transmitted across a network connection link to be reconstructed later in the same or another computer environment. Design an algorithm to serialize and deserialize a binary tree. Ensure that a binary tree can be serialized to a string and this string can be deserialized to the original tree structure.',
        'Hard',
        '{"fa30e02b-79c2-4134-b180-b62e51f9ea03", "46be1b65-0d60-4906-b229-003c0147a20a"}',
        '[{"input": ["1,2,4,null,null,5,null,null,3,null,null"], "output": "1,2,4,null,null,5,null,null,3,null,null"}]',
        'serialize'
    ),
    (
        '655ce7e0-6944-433b-bb9e-c709680c0095',
        'Wildcard Matching',
        'Given an input string s and a pattern p, implement wildcard pattern matching with support for ? and * where: ? matches any single character. * matches any sequence of characters (including the empty sequence). The matching should cover the entire input string (not partial).',
        'Hard',
        '{"e6811add-b0a5-4ef2-b105-affae358efc5", "46be1b65-0d60-4906-b229-003c0147a20a"}',
        '[{"input": ["aa", "a*"], "output": true}]',
        'isMatch'
    ),
    (
        '3437471a-8db3-4355-8e63-68c91ce43ed5',
        'Chalkboard XOR Game',
        'You are given an array of integers nums representing the numbers written on a chalkboard. Alice and Bob take turns erasing exactly one number from the chalkboard, with Alice starting first. If erasing a number causes the bitwise XOR of all the elements of the chalkboard to become 0, then that player loses. The bitwise XOR of one element is that element itself, and the bitwise XOR of no elements is 0. If any player starts their turn with the bitwise XOR of all the elements of the chalkboard equal to 0, then that player wins. Return true if and only if Alice wins the game, assuming both players play optimally.',
        'Hard',
        '{"3f78df1b-bcbc-4e58-b3f4-f139fe8acae1"}',
        '[{"input": [[1, 1, 2]], "output": false}]',
        'xorGame'
    ),
    (
        'f455ccfa-7f73-4055-9256-49fb3c7ef892',
        'Trips and Users',
        'Given the Trips and Users tables, find the cancellation rate of requests with unbanned users (both client and driver must not be banned) each day between "2013-10-01" and "2013-10-03". Round Cancellation Rate to two decimal points. Return the result table in any order.',
        'Hard',
        '{"fa30e02b-79c2-4134-b180-b62e51f9ea03"}',
        '[{"input": ["2013-10-01"], "output": 0.5}, {"input": ["2013-10-02"], "output": 0.5}]',
        'tripsAndUsers'
    );

--Combined table

INSERT INTO qn_topics (
    quid, 
    tid, 
    difficulty
) 
VALUES 
    ('3d9fd353-797d-4797-97a2-fb060553ce16', '12ce1abf-7060-404e-bcb9-671e9d5c55e4', 'Easy'),
    ('3d9fd353-797d-4797-97a2-fb060553ce16', 'e6811add-b0a5-4ef2-b105-affae358efc5', 'Easy'),
    ('230d15b4-78d5-4338-a7a6-be8db6e10753', '46be1b65-0d60-4906-b229-003c0147a20a', 'Easy'),
    ('230d15b4-78d5-4338-a7a6-be8db6e10753', 'fa30e02b-79c2-4134-b180-b62e51f9ea03', 'Easy'),
    ('73403133-0bb3-4c9f-ad31-b8b804b6845b', '46be1b65-0d60-4906-b229-003c0147a20a', 'Easy'),
    ('6cdca01d-80bf-4de8-b222-39486838351c', '46be1b65-0d60-4906-b229-003c0147a20a', 'Easy'),
    ('6cdca01d-80bf-4de8-b222-39486838351c', '77856f4f-70c4-4e65-95b4-8b59ea769296', 'Easy'),
    ('4022c1dc-f74b-466d-aa6a-5e3fa0f42453', '46be1b65-0d60-4906-b229-003c0147a20a', 'Easy'),
    ('4022c1dc-f74b-466d-aa6a-5e3fa0f42453', '8d58e050-fcb9-4761-9982-d1703de69948', 'Easy'),
    ('7de26940-b5c3-446e-91e9-d92d2c526cee', 'fa30e02b-79c2-4134-b180-b62e51f9ea03', 'Easy'),
    ('a7dc2628-31a6-4a2a-83da-16bebaa91363', '75dfe195-825a-4260-ba85-29bbf71d185b', 'Easy'),
    ('d3635fbe-1a99-421c-af81-229ee9608948', '46be1b65-0d60-4906-b229-003c0147a20a', 'Medium'),
    ('d3635fbe-1a99-421c-af81-229ee9608948', '77856f4f-70c4-4e65-95b4-8b59ea769296', 'Medium'),
    ('c807ed97-7653-437e-88fb-396ce18a5396', '46be1b65-0d60-4906-b229-003c0147a20a', 'Medium'),
    ('c807ed97-7653-437e-88fb-396ce18a5396', 'fa30e02b-79c2-4134-b180-b62e51f9ea03', 'Medium'),
    ('7309cd44-6d64-4c94-95bd-756fa8eefa43', 'fa30e02b-79c2-4134-b180-b62e51f9ea03', 'Medium'),
    ('a5e621ca-b4b2-437a-a76e-fea9303ed561', 'e6811add-b0a5-4ef2-b105-affae358efc5', 'Medium'),
    ('a5e621ca-b4b2-437a-a76e-fea9303ed561', '46be1b65-0d60-4906-b229-003c0147a20a', 'Medium'),
    ('f0543396-6f85-4962-9aad-1c08e9b46934', '46be1b65-0d60-4906-b229-003c0147a20a', 'Medium'),
    ('f0543396-6f85-4962-9aad-1c08e9b46934', '1333d309-33bc-4f5d-8e13-f241e5b519fa', 'Medium'),
    ('e989e3fc-7224-454d-acbe-32ecb7c606ad', '3f78df1b-bcbc-4e58-b3f4-f139fe8acae1', 'Medium'),
    ('0631a318-191d-4515-9fe3-72d925ecace8', '46be1b65-0d60-4906-b229-003c0147a20a', 'Medium'),
    ('0631a318-191d-4515-9fe3-72d925ecace8', 'fa30e02b-79c2-4134-b180-b62e51f9ea03', 'Medium'),
    ('243e8ad8-49f3-46ac-a017-e6f505d0eaa2', '46be1b65-0d60-4906-b229-003c0147a20a', 'Hard'),
    ('243e8ad8-49f3-46ac-a017-e6f505d0eaa2', '1333d309-33bc-4f5d-8e13-f241e5b519fa', 'Hard'),
    ('e8fd0042-e7d8-4a1f-84bc-060fbd57cfda', '46be1b65-0d60-4906-b229-003c0147a20a', 'Hard'),
    ('03603811-8f78-4cbd-9231-6eaa750f4c57', '46be1b65-0d60-4906-b229-003c0147a20a', 'Hard'),
    ('03603811-8f78-4cbd-9231-6eaa750f4c57', 'fa30e02b-79c2-4134-b180-b62e51f9ea03', 'Hard'),
    ('655ce7e0-6944-433b-bb9e-c709680c0095', 'e6811add-b0a5-4ef2-b105-affae358efc5', 'Hard'),
    ('655ce7e0-6944-433b-bb9e-c709680c0095', '46be1b65-0d60-4906-b229-003c0147a20a', 'Hard'),
    ('3437471a-8db3-4355-8e63-68c91ce43ed5', '3f78df1b-bcbc-4e58-b3f4-f139fe8acae1', 'Hard'),
    ('f455ccfa-7f73-4055-9256-49fb3c7ef892', 'fa30e02b-79c2-4134-b180-b62e51f9ea03', 'Hard');