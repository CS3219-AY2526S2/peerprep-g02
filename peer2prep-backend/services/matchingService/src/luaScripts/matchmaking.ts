export const MATCHMAKING_LUA = `
-- KEYS:
-- 1...n:  Queue keys (mm:q:topic:diff:lang)
-- n+1:    Seeker's metadata key (mm:u:userId)

-- ARGV:
-- 1: now (timestamp)
-- 2: numQueues
-- 3: queueKeysJson (JSON array of the KEYS[1...n])

local now           = ARGV[1]
local numQueues     = tonumber(ARGV[2])
local queueKeysJson = ARGV[3]
local seekerKey     = KEYS[numQueues + 1]

local maxCandidatesPerQueue = 10

-- Helper: No string building needed, userKey IS the value in the ZSET
local function remove_from_all_queues(userKey)
    local keysRaw = redis.call('HGET', userKey, 'queues')
    if keysRaw then
        local queueKeys = cjson.decode(keysRaw)
        for _, qKey in ipairs(queueKeys) do
            redis.call('ZREM', qKey, userKey)
        end
    end
    redis.call('DEL', userKey)
end

-- 1. Try match
for i = 1, numQueues do
    local queueKey = KEYS[i]
    local candidateKeys = redis.call('ZRANGE', queueKey, 0, maxCandidatesPerQueue - 1)

    for _, candidateKey in ipairs(candidateKeys) do
        if candidateKey ~= seekerKey then
            remove_from_all_queues(candidateKey)
            remove_from_all_queues(seekerKey)
            local matchedPartnerId = candidateKey:match("([^:]+)$")
            local matchedLang = queueKey:match("([^:]+)$")
            
            return { 'matched', matchedPartnerId, matchedLang }
        end
    end
end

-- 2. Enqueue if no match
for i = 1, numQueues do
    redis.call('ZADD', KEYS[i], now, seekerKey)
end

-- Store the queue list for later cleanup
redis.call('HSET', seekerKey, 'queues', queueKeysJson)

return { 'enqueued', '', '' }
`;
