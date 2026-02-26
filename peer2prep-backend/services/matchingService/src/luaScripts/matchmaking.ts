import { QUEUE_PREFIX, USER_PREFIX } from "@/types/match.js";

export const MATCHMAKING_LUA = `
-- KEYS:
-- 1...n: Queue keys for the languages user wants

-- ARGV:
-- 1: userId
-- 2: topic
-- 3: difficulty
-- 4: languages (JSON string)
-- 5: now (timestamp)
-- 6: numQueues (how many keys provided are queues)


local seekerId              = ARGV[1]
local topic                 = ARGV[2]
local difficulty            = ARGV[3]
local languagesStr          = ARGV[4]
local now                   = ARGV[5]
local numQueues             = tonumber(ARGV[6])
local maxCandidatesPerQueue = 10

-- Helper: remove a user from all their queues
local function remove_from_all_queues(userId)
    local partnerKey = "${USER_PREFIX}:" .. userId
    local partnerLangsRaw = redis.call('HGET', partnerKey, 'languages')
    local partnerTopic = redis.call('HGET', partnerKey, 'topic')
    local partnerDifficulty = redis.call('HGET', partnerKey, 'difficulty')

    if partnerLangsRaw and partnerTopic and partnerDifficulty then
        local partnerLangs = cjson.decode(partnerLangsRaw)
        for _, lang in ipairs(partnerLangs) do
            local pQueueKey = "${QUEUE_PREFIX}:" .. partnerTopic .. ":" .. partnerDifficulty .. ":" .. lang
            redis.call('ZREM', pQueueKey, userId)
        end
    end

    -- Remove user metadata
    redis.call('DEL', partnerKey)
end


-- Try match
for i = 1, numQueues do
    local queueKey = KEYS[i]
    local candidates = redis.call('ZRANGE', queueKey, 0, maxCandidatesPerQueue - 1)

    if candidates and #candidates > 0 then
        for _, candidateId in ipairs(candidates) do
            if candidateId and candidateId ~= seekerId then
                remove_from_all_queues(candidateId)
                remove_from_all_queues(seekerId)
                local matchedLang = queueKey:match("([^:]+)$")
                return { 'matched', candidateId, matchedLang }
            end
        end
    end
end


-- Enqueue if no match
for i = 1, numQueues do
    redis.call('ZADD', KEYS[i], now, seekerId)
end

local seekerKey = "${USER_PREFIX}:" .. seekerId

redis.call('HSET', seekerKey,
    'topic', topic,
    'difficulty', difficulty,
    'languages', languagesStr
)

return { 'enqueued', '', '' }
`;
