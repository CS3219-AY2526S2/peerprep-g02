export const FIND_MATCH_LUA_SCRIPT = `
-- KEYS:
-- 1...n:   Queue keys (mm:q:topic:diff:lang)
-- n+1:     Seeker's status key (mm:us:userId)

-- ARGV:
-- 1: now (timestamp in ms)
-- 2: numQueues
-- 3: queueKeysJson (JSON array of the KEYS[1...n])

local now           = tonumber(ARGV[1])
local numQueues     = tonumber(ARGV[2])
local queueKeysJson = ARGV[3]
local seekerKey     = KEYS[numQueues + 1]

local maxCandidatesPerQueue = 10
local gracePeriodMs = 5000

-- Helper: Remove user from all tracked ZSETs and delete their status HSET
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

if redis.call('EXISTS', seekerKey) == 1 then
    remove_from_all_queues(seekerKey)
end

-- 1. Try match
for i = 1, numQueues do
    local queueKey = KEYS[i]
    local candidateKeys = redis.call('ZRANGE', queueKey, 0, maxCandidatesPerQueue - 1)

    for _, candidateKey in ipairs(candidateKeys) do
        if candidateKey ~= seekerKey then
            local data = redis.call('HMGET', candidateKey, 'status', 'last_seen')
            local status = data[1]
            
            if not status then
                redis.call('ZREM', queueKey, candidateKey)
            else
                local lastSeen = tonumber(data[2] or 0)

                if status == 'DISCONNECTED' then
                    if (now - lastSeen) > gracePeriodMs then
                        remove_from_all_queues(candidateKey)
                    end
                    -- Skip to next candidate
                elseif status == 'READY' then
                    remove_from_all_queues(candidateKey)
                    remove_from_all_queues(seekerKey)
                    
                    local matchedPartnerId = candidateKey:match("([^:]+)$")
                    local matchedLang = queueKey:match("([^:]+)$")
                    
                    return { 'matched', matchedPartnerId, matchedLang }
                end
                -- If status is 'MATCHED', we just skip them
            end
        end
    end
end

-- 2. Enqueue if no match
for i = 1, numQueues do
    redis.call('ZADD', KEYS[i], now, seekerKey)
end

-- Update seeker status to READY and store the queues they are in
redis.call('HSET', seekerKey, 'queues', queueKeysJson, 'status', 'READY', 'last_seen', now)

return { 'enqueued', '', '' }
`;

export const ATTEMPT_REJOIN_LUA_SCRIPT = `
-- KEYS: 1: Seeker's metadata key (mm:us:userId)
-- ARGV: 1: now (timestamp)

local seekerKey = KEYS[1]
local now = tonumber(ARGV[1])
local gracePeriodMs = 5000

local data = redis.call('HMGET', seekerKey, 'status', 'last_seen')
local status = data[1]

if not status then
    return { 'fail' }
end

local lastSeen = tonumber(data[2] or 0)

if status == 'READY' then
    return { 'success' }
elseif status == 'DISCONNECTED' then
    if (now - lastSeen) > gracePeriodMs then
        return { 'fail' }
    else
        -- Partial HSET: revive status
        redis.call('HSET', seekerKey, 'status', 'READY', 'last_seen', now)
        return { 'success' }
    end
else
    -- should not reach
    redis.call('DEL', seekerKey)
    return { 'fail' }
end
`;

export const DISCONNECT_LUA_SCRIPT = `
-- KEYS: 1: Seeker's metadata key (mm:us:userId)
-- ARGV: 1: now (timestamp)

local seekerKey = KEYS[1]
local now = ARGV[1]

if redis.call('EXISTS', seekerKey) == 1 then
    redis.call('HSET', seekerKey, 'status', 'DISCONNECTED', 'last_seen', now)
end
return { 'ok' }
`;

export const CANCEL_MATCH_LUA_SCRIPT = `
-- KEYS: 1: Seeker's metadata key (mm:us:userId)

local seekerKey = KEYS[1]

if redis.call('EXISTS', seekerKey) == 1 then
    local keysRaw = redis.call('HGET', seekerKey, 'queues')
    if keysRaw then
        local queueKeys = cjson.decode(keysRaw)
        for _, qKey in ipairs(queueKeys) do
            redis.call('ZREM', qKey, seekerKey)
        end
    end
    redis.call('DEL', seekerKey)
end
return { 'ok' }
`;
