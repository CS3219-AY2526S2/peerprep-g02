CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE questions (
    quid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    topics TEXT[] NOT NULL,
    image BYTEA,
    test_case JSON,
    popularity_score INT DEFAULT 0
);

CREATE TABLE topics (
    tid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL
);

CREATE TABLE qncats (
    quid UUID,
    tid UUID,
    topic TEXT NOT NULL,
    difficulty TEXT NOT NULL,

    PRIMARY KEY (quid, tid),

    FOREIGN KEY (quid) REFERENCES questions(quid),
    FOREIGN KEY (tid) REFERENCES topics(tid)
);


INSERT INTO questions (
    title,
    description,
    difficulty,
    topics,
    test_case
)
VALUES (
    'Two Sum',
    'Given an array of integers, return indices of the two numbers such that they add up to a target.',
    'easy',
    ARRAY['arrays', 'hashmap'],
    '{
        "input": [2, 7, 11, 15],
        "output": [0, 1]
    }'
);

